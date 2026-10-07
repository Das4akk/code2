import 'dotenv/config';
import admin from 'firebase-admin';

const rawKey = process.env.FIREBASE_ADMIN_KEY;
const dbUrl = process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com';

if (!rawKey) {
  console.error('FIREBASE_ADMIN_KEY is not set in environment or .env file.');
  process.exit(1);
}

try {
  const sa = JSON.parse(rawKey.trim().replace(/^"|"$/g, ''));
  if (sa.private_key && sa.private_key.includes('\\n')) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL: dbUrl,
  });
} catch (err) {
  console.error('Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}

(async () => {
  console.log('Fetching users from Firebase Realtime Database...');
  const usersSnap = await admin.database().ref('users').once('value');
  const users = usersSnap.val() || {};
  let migrated = 0;
  let total = 0;

  for (const [uid, data] of Object.entries(users)) {
    total++;
    const updates = {};
    const prof = data.profile || {};

    if (!data.profile) {
      updates['profile'] = {
        name: data.name || data.displayName || data.username || 'Пользователь',
        username: data.username || 'user',
        avatar: data.avatar || data.photoURL || '',
        role: data.role || 'user',
        premium: Boolean(data.premium),
        lumens: Number(data.lumens) || 0,
        xp: Number(data.xp) || 0,
        level: Number(data.level) || 1,
        streak: Number(data.streak) || 0,
      };
    } else {
      if (!prof.role) updates['profile/role'] = data.role || 'user';
      if (prof.premium === undefined) updates['profile/premium'] = Boolean(data.premium);
      if (prof.lumens === undefined) updates['profile/lumens'] = Number(data.lumens) || 0;
      if (prof.xp === undefined) updates['profile/xp'] = Number(data.xp) || 0;
      if (prof.level === undefined) updates['profile/level'] = Number(data.level) || 1;
      if (prof.streak === undefined) updates['profile/streak'] = Number(data.streak) || 0;
    }

    if (Object.keys(updates).length > 0) {
      await admin.database().ref(`users/${uid}`).update(updates);
      migrated++;
    }
  }

  console.log(`Successfully migrated ${migrated} out of ${total} users.`);
  process.exit(0);
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
