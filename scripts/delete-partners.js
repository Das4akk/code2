const admin = require('firebase-admin');
require('dotenv').config();

const sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
if (sa.private_key && sa.private_key.includes('\\n')) {
  sa.private_key = sa.private_key.replace(/\\n/g, '\n');
}
admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

(async () => {
  const usersSnap = await admin.database().ref('users').once('value');
  const users = usersSnap.val() || {};
  let count = 0;
  for (const uid of Object.keys(users)) {
    const ref = admin.database().ref(`users/${uid}`);
    await ref.child('partner').remove();
    await ref.child('loveRequests').remove();
    count++;
  }
  console.log(`Cleaned partner/loveRequests for ${count} users`);
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
