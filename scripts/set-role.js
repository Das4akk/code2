import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyEnv = process.env.FIREBASE_ADMIN_KEY;
let serviceAccount = null;

if (keyEnv) {
  try {
    serviceAccount = typeof keyEnv === 'string' ? JSON.parse(keyEnv) : keyEnv;
  } catch (e) {
    console.error('Error parsing FIREBASE_ADMIN_KEY environment variable:', e.message);
    process.exit(1);
  }
} else {
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  } else {
    console.error('Error: Neither FIREBASE_ADMIN_KEY nor serviceAccountKey.json was found.');
    process.exit(1);
  }
}

if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL
});

const uid = process.argv[2];
const role = process.argv[3];
const email = process.argv[4] || null;

if (!uid || !role) {
  console.error('Usage: node scripts/set-role.js <UID> <role> [email]');
  console.error('Example: node scripts/set-role.js hOjOUa2ayfPIHk2j5unqAa1UUXi2 creator ManKaef@yandex.ru');
  process.exit(1);
}

(async () => {
  const isOwner = role === 'creator';
  await admin.database().ref(`admins/${uid}`).set({
    role,
    isOwner,
    email,
    grantedAt: Date.now(),
    grantedBy: 'manual_cli'
  });
  await admin.database().ref(`users/${uid}/profile/role`).set(role);
  try {
    await admin.auth().setCustomUserClaims(uid, { role });
  } catch (claimErr) {
    console.warn(`[set-role] Warning setting custom user claims: ${claimErr.message}`);
  }
  console.log(`✅ Role "${role}" granted to ${uid} (${email || 'no email specified'})`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Failed to assign role:', err);
  process.exit(1);
});
