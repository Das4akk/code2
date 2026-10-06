import { getDb } from '../helpers/firebase.js';
import { requireAdmin } from '../helpers/auth.js';

export async function recalcLeaderboard(req, res) {
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

    const db = getDb();
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const leaderboard = [];

    for (const [uid, data] of Object.entries(users)) {
      const profile = data.profile || {};
      const name = (profile.name || data.name || profile.displayName || data.displayName || profile.username || data.username || (data.email ? data.email.split('@')[0] : '') || 'Пользователь').trim();
      const username = (profile.username || data.username || (data.email ? data.email.split('@')[0] : '') || 'user').trim();
      const avatar = profile.avatar || data.avatar || profile.photoURL || data.photoURL || '';
      const frame = profile.frame || data.equippedFrame || '';
      const lumens = Number(profile.lumens != null ? profile.lumens : (data.lumens != null ? data.lumens : 0)) || 0;
      const xp = Number(profile.xp != null ? profile.xp : (data.xp != null ? data.xp : 0)) || 0;
      const level = Number(profile.level != null ? profile.level : (data.level != null ? data.level : 1)) || 1;
      const timeSpentInRooms = Number(profile.timeSpentInRooms != null ? profile.timeSpentInRooms : (data.timeSpentInRooms != null ? data.timeSpentInRooms : 0)) || 0;
      const streak = Number(profile.streak != null ? profile.streak : (data.streak != null ? data.streak : 0)) || 0;
      const likedBy = profile.likedBy || data.likedBy || {};
      const likesCount = Object.keys(likedBy).length;

      leaderboard.push({
        uid,
        name,
        username,
        avatar,
        frame,
        xp,
        level,
        lumens,
        streak,
        likes: likesCount,
        timeSpentInRooms,
        likedBy
      });
    }

    leaderboard.sort((a, b) => (b.lumens || 0) - (a.lumens || 0));
    const top100 = leaderboard.slice(0, 100);

    await db.ref('leaderboard').set({
      updatedAt: Date.now(),
      users: top100,
    });

    return res.status(200).json({ success: true, count: top100.length });
  } catch (err) {
    console.error('[admin/recalc-leaderboard]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export async function updateUserField(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const adminUser = await requireAdmin(req);
    if (!adminUser) return res.status(403).json({ error: 'Forbidden' });

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

    const db = getDb();
    await db.ref(`users/${targetUid}/${path}`).set(value);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[admin/update-user-field]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
