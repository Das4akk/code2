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
      console.warn('[check-role] Unauthorized: verifyToken returned null');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: token invalid or FIREBASE_ADMIN_KEY missing/malformed',
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
    console.log('[check-role] env role=', role, 'uid=', uid, 'email=', email);

    // ШАГ 2: Если не в ENV-whitelist — читаем из БД /admins/{uid}.
    if (role !== 'creator') {
      try {
        const db = getDb();
        if (db) {
          const adminSnap = await db.ref(`admins/${uid}`).once('value');
          console.log('[check-role] /admins/' + uid + ' exists=', adminSnap.exists(), 'val=', adminSnap.val());
          if (adminSnap.exists()) {
            const admVal = adminSnap.val();
            role = (typeof admVal === 'object' && admVal?.role)
              ? String(admVal.role).toLowerCase()
              : 'creator';
          }
        }
      } catch (dbErr) {
        console.error('[check-role DB ERROR]:', dbErr.message, dbErr.stack);
      }
    }

    // ШАГ 3 (TEMP FALLBACK): Проверяем /config/roles/creators если роль осталась 'user'
    if (role === 'user') {
      const normEmail = (email || '').toLowerCase().trim();
      const cleanUid = (uid || '').trim();
      try {
        const db = getDb();
        if (db) {
          const cfgSnap = await db.ref('config/roles/creators').once('value');
          const cfg = cfgSnap.val() || {};
          if (cfg[normEmail] || cfg[cleanUid]) {
            role = 'creator';
            console.log('[check-role] role resolved to creator from /config/roles/creators');
          }
        }
      } catch (cfgErr) {
        console.warn('[check-role config/roles fallback warning]:', cfgErr.message);
      }
    }

    const isCreator = role === 'creator';
    const isAdmin = isCreator || ['admin', 'operator', 'moderator', 'manager'].includes(role);

    // ШАГ 4: Синхронизация /admins/{uid} только если нужно.
    if (isAdmin) {
      try {
        const db = getDb();
        if (db) {
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
