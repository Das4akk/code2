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
    const isOwnerEmail = decoded.email === 'mankaef@yandex.ru' || decoded.email === 'das4akk2@gmail.com' || decoded.email === 'platega3@gmail.com';
    if (!adminSnap.exists() && !isOwnerEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const usersSnap = await admin.database().ref('users').once('value');
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
