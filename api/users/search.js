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

    await admin.auth().verifyIdToken(idToken);
    const query = String(req.query.q || '').trim().toLowerCase();
    if (query.length < 2) return res.status(400).json({ error: 'Query too short' });

    const usernamesSnap = await admin.database().ref('usernames').once('value');
    const usernames = usernamesSnap.val() || {};
    const results = [];

    for (const [username, uid] of Object.entries(usernames)) {
      if (username.toLowerCase().includes(query)) {
        const userSnap = await admin.database().ref(`users/${uid}/profile`).once('value');
        const profile = userSnap.val() || {};
        results.push({
          uid,
          username,
          displayName: profile.displayName || profile.name || username,
          avatar: profile.avatar || "",
          name: profile.name || username
        });
        if (results.length >= 20) break;
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[users/search]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
