const CREATOR_EMAILS = (process.env.CREATOR_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function getRoleFromEnv(email) {
  const norm = (email || '').toLowerCase().trim();
  if (CREATOR_EMAILS.includes(norm) || ADMIN_EMAILS.includes(norm)) return 'creator';
  return 'user';
}

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(200).json({ role: 'user' });

    // Lazy init Firebase Admin
    const admin = (await import('firebase-admin')).default;
    if (!admin.apps.length) {
      const raw = process.env.FIREBASE_ADMIN_KEY;
      if (!raw) return res.status(200).json({ role: 'user', warning: 'FIREBASE_ADMIN_KEY not set' });
      const sa = JSON.parse(raw.trim().replace(/^"|"$/g, ''));
      if (sa.private_key && sa.private_key.includes('\\n')) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email;

    // Проверяем /admins/{uid}
    let role = getRoleFromEnv(email);
    let isOwner = false;
    try {
      const snap = await admin.database().ref(`admins/${uid}`).once('value');
      if (snap.exists()) {
        const data = snap.val();
        if (data.role) role = data.role;
        if (data.isOwner) isOwner = true;
      }
    } catch (e) {
      console.warn('[check-role] admins read failed:', e.message);
    }

    return res.status(200).json({ role, isOwner, uid, email });
  } catch (err) {
    console.error('[check-role] FATAL:', err.message, err.stack);
    return res.status(200).json({ role: 'user', error: err.message });
  }
}
