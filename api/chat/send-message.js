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
    const { roomId, text } = req.body || {};
    if (!roomId || !text) return res.status(400).json({ error: 'Missing roomId or text' });
    if (text.length > 2000) return res.status(400).json({ error: 'Text too long' });

    const msgRef = admin.database().ref(`rooms/${roomId}/chat`).push();
    await msgRef.set({
      authorUid: decoded.uid,
      authorEmail: decoded.email || '',
      text,
      createdAt: Date.now(),
      timestamp: Date.now(),
    });

    return res.status(200).json({ success: true, id: msgRef.key });
  } catch (err) {
    console.error('[chat/send-message]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
