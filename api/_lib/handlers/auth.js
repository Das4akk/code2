import { setCors, getRoleFromEnv, verifyToken } from '../helpers/auth.js';
import { getDb } from '../helpers/firebase.js';

export async function checkRole(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    const email = decoded.email || '';
    let role = getRoleFromEnv(uid, email);

    if (role !== 'creator') {
      try {
        const db = getDb();
        const [adminSnap, userSnap] = await Promise.all([
          db.ref(`admins/${uid}`).once('value'),
          db.ref(`users/${uid}/role`).once('value')
        ]);
        if (adminSnap.exists()) {
          role = 'creator';
        } else if (userSnap.exists()) {
          role = String(userSnap.val() || 'user').toLowerCase();
        }
      } catch (dbErr) {}
    }

    const isCreator = role === 'creator';
    const isAdmin = isCreator || role === 'admin' || role === 'moderator' || role === 'manager';

    return res.status(200).json({
      success: true,
      role,
      isCreator,
      isAdmin,
      isOwner: isCreator,
      isDeveloper: isCreator
    });
  } catch (err) {
    console.error('[auth/check-role]', err.message);
    return res.status(200).json({
      success: true,
      role: 'user',
      isCreator: false,
      isAdmin: false,
      isOwner: false,
      isDeveloper: false
    });
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
