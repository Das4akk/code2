import admin from 'firebase-admin';

let initialized = false;

export function initAdmin() {
  if (initialized || admin.apps.length) {
    initialized = true;
    return admin;
  }
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    // If no key in current environment, avoid crashing immediately unless accessed
    return admin;
  }
  try {
    const sa = JSON.parse(raw.trim().replace(/^"|"$/g, ''));
    if (sa.private_key && sa.private_key.includes('\\n')) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://cowio-dfc77-default-rtdb.firebaseio.com',
    });
    initialized = true;
  } catch (err) {
    console.error('[Firebase Admin Init Error]:', err.message);
  }
  return admin;
}

export function getDb() {
  initAdmin();
  return admin.database();
}

export function getAuth() {
  initAdmin();
  return admin.auth();
}

export default admin;
