import { setCors, getRoleFromEnv, verifyToken } from '../helpers/auth.js';
import { getDb } from '../helpers/firebase.js';

const ROLE_DISPLAY_NAMES = {
  creator: 'Создатель',
  operator: 'Оператор',
  manager: 'Менеджер',
  moderator: 'Модератор',
  admin: 'Администратор',
  user: 'Пользователь',
};

export async function checkRole(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const decoded = await verifyToken(req);
    if (!decoded) {
      return res.status(200).json({
        success: true,
        role: 'user',
        isCreator: false,
        isAdmin: false,
        isOwner: false,
        isDeveloper: false
      });
    }

    const uid = decoded.uid || '';
    const email = (decoded.email || '').toLowerCase().trim();

    // ШАГ 1: Проверяем ENV-whitelist. Абсолютный приоритет.
    let role = getRoleFromEnv(uid, email);
    const isInEnvWhitelist = (role === 'creator');

    // ШАГ 2: Если не в ENV-whitelist — читаем из БД /admins/{uid}.
    if (!isInEnvWhitelist) {
      try {
        const db = getDb();
        const adminSnap = await db.ref(`admins/${uid}`).once('value');
        if (adminSnap.exists()) {
          const admVal = adminSnap.val();
          role = (typeof admVal === 'object' && admVal?.role)
            ? String(admVal.role).toLowerCase()
            : 'creator';
        }
      } catch (dbErr) {
        console.warn('[check-role DB Warning]:', dbErr.message);
      }
    }

    const isCreator = role === 'creator';
    const isAdmin = isCreator || ['admin', 'operator', 'moderator', 'manager'].includes(role);

    // ШАГ 3: Синхронизация /admins/{uid} только если нужно.
    if (isAdmin) {
      try {
        const db = getDb();
        const existing = (await db.ref(`admins/${uid}`).once('value')).val();
        const needsSync = !existing
          || existing.role !== role
          || existing.isOwner !== isCreator
          || existing.isDeveloper !== isCreator;
        if (needsSync) {
          await db.ref(`admins/${uid}`).update({
            role: role,
            isOwner: isCreator,
            isDeveloper: isCreator,
            email: email,
            updatedAt: Date.now()
          });
        }
      } catch (syncErr) {
        console.warn('[check-role Sync Warning]:', syncErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      role,
      isCreator,
      isAdmin,
      isOwner: isCreator,
      isDeveloper: isCreator,
      uid,
      email
    });

  } catch (err) {
    console.error('[check-role FATAL]:', err.message, err.stack);
    return res.status(500).json({
      success: false,
      error: err.message,
      role: 'user',
      isCreator: false,
      isAdmin: false,
      isOwner: false,
      isDeveloper: false
    });
  }
}

export async function claimRole(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const decoded = await verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }

    const { secret, role: requestedRole } = req.body || {};
    const cleanSecret = String(secret || '').trim();
    if (!cleanSecret) {
      return res.status(400).json({ success: false, error: 'Секретный ключ не указан' });
    }

    let grantedRole = null;
    const secCreator = (process.env.ROLE_SECRET_CREATOR || process.env.ADMIN_SECRET_KEY || '').trim();
    const secOperator = (process.env.ROLE_SECRET_OPERATOR || '').trim();
    const secManager = (process.env.ROLE_SECRET_MANAGER || '').trim();
    const secModerator = (process.env.ROLE_SECRET_MODERATOR || '').trim();

    if (secCreator && cleanSecret === secCreator) {
      grantedRole = 'creator';
    } else if (secOperator && cleanSecret === secOperator) {
      grantedRole = 'operator';
    } else if (secManager && cleanSecret === secManager) {
      grantedRole = 'manager';
    } else if (secModerator && cleanSecret === secModerator) {
      grantedRole = 'moderator';
    } else if (requestedRole && ['creator', 'admin', 'moderator', 'manager'].includes(requestedRole)) {
      if (cleanSecret === secCreator) grantedRole = requestedRole;
    }

    if (!grantedRole) {
      return res.status(403).json({ success: false, error: 'Неверный секретный ключ' });
    }

    const isCreator = grantedRole === 'creator';
    const db = getDb();
    const uid = decoded.uid;
    const email = decoded.email || '';

    try {
      await db.ref(`admins/${uid}`).set({
        role: grantedRole,
        email,
        claimedAt: Date.now(),
        isOwner: isCreator,
        updatedAt: Date.now()
      });
      await db.ref(`users/${uid}/profile/role`).set(grantedRole);
      await db.ref(`users/${uid}/role`).set(grantedRole);
    } catch (dbErr) {
      console.error('[claimRole DB Error]:', dbErr.message);
    }

    const roleTitle = ROLE_DISPLAY_NAMES[grantedRole] || grantedRole;
    return res.status(200).json({
      success: true,
      uid,
      role: grantedRole,
      isCreator,
      isAdmin: true,
      message: `Вам успешно выданы права: ${roleTitle}`
    });
  } catch (err) {
    console.error('[auth/claim-role error]:', err.message);
    return res.status(500).json({ success: false, error: 'Ошибка активации роли' });
  }
}

export async function geo(req, res) {
  setCors(req, res);
  try {
    const countryCode = req.headers?.['x-vercel-ip-country'] || req.headers?.['cf-ipcountry'] || req.headers?.['x-country-code'] || 'RU';
    const countryName = req.headers?.['x-vercel-ip-country-region'] || countryCode;
    const ip = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '';
    
    return res.status(200).json({
      success: true,
      country: countryCode,
      countryName,
      ip
    });
  } catch (err) {
    return res.status(200).json({ success: true, country: 'RU', countryName: 'Россия' });
  }
}
