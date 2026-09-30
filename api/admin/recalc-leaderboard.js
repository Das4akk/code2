import admin from 'firebase-admin';

export default async function handler(req, res) {
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
    if (!adminSnap.exists() || adminSnap.val().role !== 'creator') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const usersSnap = await admin.database().ref('users').once('value');
    const users = usersSnap.val() || {};
    const leaderboard = [];

    for (const [uid, data] of Object.entries(users)) {
      const profile = data.profile || {};
      leaderboard.push({
        uid,
        username: data.username || profile.username || profile.displayName || 'anon',
        xp: profile.xp || 0,
        level: profile.level || 1,
        lumens: profile.lumens || 0,
      });
    }

    leaderboard.sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const top100 = leaderboard.slice(0, 100);

    await admin.database().ref('leaderboard').set({
      updatedAt: Date.now(),
      users: top100,
    });

    return res.status(200).json({ success: true, count: top100.length });
  } catch (err) {
    console.error('[recalc-leaderboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
