import { getDb } from '../helpers/firebase.js';
import { verifyToken, setCors } from '../helpers/auth.js';

export async function search(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'No token' });

    const query = String(req.query.q || req.body?.q || '').trim().toLowerCase();
    if (query.length < 2) return res.status(400).json({ error: 'Query too short' });

    const db = getDb();
    const usernamesSnap = await db.ref('usernames').once('value');
    const usernames = usernamesSnap.val() || {};
    const results = [];

    for (const [username, uid] of Object.entries(usernames)) {
      if (username.toLowerCase().includes(query)) {
        const userSnap = await db.ref(`users/${uid}/profile`).once('value');
        const profile = userSnap.val() || {};
        results.push({
          uid,
          username,
          displayName: profile.displayName || profile.name || username,
          avatar: profile.avatar || '',
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
