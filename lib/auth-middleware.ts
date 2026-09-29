import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { resolveAutoRole, syncRoleToDatabase, UserRole } from './roles.js';

const firebaseAdmin: any = admin;

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: string;
  isCreator?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
    }
  }
}

/**
 * Extracts Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
    return parts[1] || null;
  }
  return null;
}

/**
 * Required Authentication Middleware.
 * Verifies Firebase ID Token and sets req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Требуется авторизация (отсутствует Bearer токен)'
    });
    return;
  }

  // Development/Test mock token support for automated tests
  if (process.env.NODE_ENV === 'test' && token.startsWith('mock-token-')) {
    const mockUid = token.replace('mock-token-', '');
    req.user = {
      uid: mockUid,
      email: `${mockUid}@example.com`,
      role: mockUid.includes('admin') ? 'creator' : 'user'
    };
    next();
    return;
  }

  try {
    if (!firebaseAdmin.apps?.length) {
      // If Firebase Admin is not initialized
      res.status(503).json({
        success: false,
        error: 'Сервер авторизации Firebase временно недоступен'
      });
      return;
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: (decoded as any).role || 'user'
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: `Недействительный или просроченный токен авторизации: ${err.message}`
    });
  }
}

/**
 * Optional Authentication Middleware.
 * If token is present, populates req.user. If not, proceeds without blocking.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    req.user = null;
    next();
    return;
  }

  if (process.env.NODE_ENV === 'test' && token.startsWith('mock-token-')) {
    const mockUid = token.replace('mock-token-', '');
    req.user = {
      uid: mockUid,
      email: `${mockUid}@example.com`,
      role: mockUid.includes('admin') ? 'creator' : 'user'
    };
    next();
    return;
  }

  try {
    if (firebaseAdmin.apps?.length) {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        role: (decoded as any).role || 'user'
      };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }

  next();
}

/**
 * Role-Based Access Control Middleware.
 * Queries /admins/{uid} in Firebase Realtime Database.
 */
export function requireRole(allowedRoles: string | string[]) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.uid) {
      res.status(401).json({ success: false, error: 'Требуется авторизация' });
      return;
    }

    if (process.env.NODE_ENV === 'test' && req.user.role === 'creator') {
      next();
      return;
    }

    try {
      if (!firebaseAdmin.apps?.length) {
        res.status(503).json({ success: false, error: 'База данных недоступна' });
        return;
      }

      const db = firebaseAdmin.database();
      let adminSnap = await db.ref(`admins/${req.user.uid}`).once('value');

      // If user not in /admins, check if they automatically qualify via email/UID or Firebase config
      if (!adminSnap.exists()) {
        const autoRole = await resolveAutoRole(req.user.uid, req.user.email, db);
        if (autoRole) {
          try {
            await syncRoleToDatabase(db, req.user.uid, autoRole, req.user.email, 'auto_middleware_sync');
            adminSnap = await db.ref(`admins/${req.user.uid}`).once('value');
          } catch (syncErr: any) {
            console.warn('[COWIO Auth] Could not auto-sync role to DB:', syncErr.message);
          }
        }
      }

      if (!adminSnap.exists()) {
        res.status(403).json({
          success: false,
          error: 'Доступ запрещён: недостаточно прав (пользователь не является администратором)'
        });
        return;
      }

      const adminData = adminSnap.val();
      const userRole = String(adminData.role || '').toLowerCase().trim();

      const hasPermission = rolesArray.some((r) => r.toLowerCase().trim() === userRole || userRole === 'creator');
      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: `Доступ запрещён: требуется роль [${rolesArray.join(', ')}], ваша роль [${userRole}]`
        });
        return;
      }

      req.user.role = userRole;
      req.user.isCreator = userRole === 'creator' || adminData.isOwner === true;
      next();
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Ошибка проверки прав: ${err.message}` });
    }
  };
}
