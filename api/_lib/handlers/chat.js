import { getDb } from '../helpers/firebase.js';
import { verifyToken, setCors } from '../helpers/auth.js';

export async function sendMessage(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'No token' });

    const { roomId, text } = req.body || {};
    if (!roomId || !text) return res.status(400).json({ error: 'Missing roomId or text' });
    if (text.length > 2000) return res.status(400).json({ error: 'Text too long' });

    const db = getDb();
    const msgRef = db.ref(`rooms/${roomId}/chat`).push();
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
