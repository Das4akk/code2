const CREATOR_EMAILS = (process.env.CREATOR_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const OWNER_EMAILS = (process.env.OWNER_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const CREATOR_UIDS = (process.env.CREATOR_UIDS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = [
  'https://cowio.vercel.app',
  'https://cowio.ru',
  'https://www.cowio.ru',
  'http://localhost:3000',
  'http://localhost:5173'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function getRoleFromEnv(uid, email) {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanUid = (uid || '').trim();
  if (
    CREATOR_EMAILS.includes(normEmail) ||
    ADMIN_EMAILS.includes(normEmail) ||
    OWNER_EMAILS.includes(normEmail) ||
    CREATOR_UIDS.includes(cleanUid) ||
    ADMIN_UIDS.includes(cleanUid)
  ) {
    return 'creator';
  }
  return 'user';
}

export default async function handler(req, res) {
  // Ensure res.status and res.json exist for compatibility with Node http.ServerResponse in Vite dev
  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (data) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!idToken) {
      return res.status(200).json({
        success: true,
        role: 'user',
        isCreator: false,
        isAdmin: false,
        isOwner: false,
        isDeveloper: false
      });
    }

    let uid = '';
    let email = '';

    // Lazy init Firebase Admin if credentials are present
    const adminModule = await import('firebase-admin');
    const admin = adminModule.default || adminModule;

    if (!admin.apps || !admin.apps.length) {
      const raw = process.env.FIREBASE_ADMIN_KEY;
      if (raw) {
        try {
          let sa = typeof raw === 'string' ? JSON.parse(raw.trim().replace(/^"|"$/g, '')) : raw;
          if (sa.private_key && sa.private_key.includes('\\n')) {
            sa.private_key = sa.private_key.replace(/\\n/g, '\n');
          }

          admin.initializeApp({
            credential: admin.credential.cert(sa),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com'
          });
        } catch (initErr) {
          console.warn('[check-role] Firebase Admin init error:', initErr.message);
        }
      }
    }

    if (admin.apps && admin.apps.length) {
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || '';
      } catch (tokenErr) {
        console.warn('[check-role] verifyIdToken error:', tokenErr.message);
      }
    }

    // Fallback: parse unverified claims from JWT payload in dev / client mode
    if (!uid) {
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          uid = payload.user_id || payload.sub || payload.uid || '';
          email = payload.email || '';
        }
      } catch (_) {}
    }

    const normEmail = (email || '').toLowerCase().trim();
    const cleanUid = (uid || '').trim();

    // Check automatic role qualifications via environment variables
    let role = getRoleFromEnv(cleanUid, normEmail);
    let isCreator = role === 'creator';
    let isAdmin = isCreator;
    let isOwner = isCreator;
    let isDeveloper = isCreator;

    // Check /admins/{uid} in Firebase Realtime Database
    if (admin.apps && admin.apps.length && cleanUid) {
      try {
        const adminRef = admin.database().ref(`admins/${cleanUid}`);
        const snap = await adminRef.once('value');
        if (snap.exists()) {
          const data = snap.val() || {};
          if (data.role) role = String(data.role).toLowerCase().trim();
          if (data.isOwner || data.isDeveloper || role === 'creator') {
            isCreator = true;
            isAdmin = true;
            isOwner = true;
            isDeveloper = true;
          } else if (['operator', 'manager', 'moderator'].includes(role)) {
            isAdmin = true;
          }
        } else if (isCreator) {
          // Auto-sync role to /admins/{uid} and /users/{uid}/profile/role for whitelisted creators
          try {
            await Promise.all([
              adminRef.set({
                role: 'creator',
                isOwner: true,
                isDeveloper: true,
                email: normEmail || null,
                grantedAt: Date.now(),
                grantedBy: 'auto_sync'
              }),
              admin.database().ref(`users/${cleanUid}/profile/role`).set('creator')
            ]);
            console.log(`[check-role] Auto-created /admins/${cleanUid} for ${normEmail || cleanUid}`);
          } catch (syncErr) {
            console.warn('[check-role] auto-sync error:', syncErr.message);
          }
        }
      } catch (e) {
        console.warn('[check-role] admins read failed:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      role,
      isCreator,
      isAdmin,
      isOwner,
      isDeveloper,
      uid: cleanUid,
      email: normEmail
    });
  } catch (err) {
    console.error('[check-role] FATAL:', err.message, err.stack);
    return res.status(200).json({
      success: false,
      role: 'user',
      isCreator: false,
      isAdmin: false,
      isOwner: false,
      isDeveloper: false,
      error: err.message
    });
  }
}
