import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'No token' });

    if (!admin.apps.length) {
      const sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY.trim().replace(/^"|"$/g, ''));
      if (sa.private_key && sa.private_key.includes('\\n')) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const adminSnap = await admin.database().ref(`admins/${decoded.uid}`).once('value');
    if (!adminSnap.exists()) return res.status(403).json({ error: 'Forbidden' });

    const { targetUid, path, value } = req.body || {};
    if (!targetUid || !path) return res.status(400).json({ error: 'Missing params' });

    const allowedPaths = [
      'premium',
      'lumens',
      'profile/xp',
      'profile/streak',
      'profile/level',
      'profile/lumens',
      'profile/premium',
      'role',
      'profile/role',
      'dailyGiftLumens',
    ];
    if (!allowedPaths.includes(path)) return res.status(400).json({ error: 'Path not allowed' });

    await admin.database().ref(`users/${targetUid}/${path}`).set(value);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin/update-user-field]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
