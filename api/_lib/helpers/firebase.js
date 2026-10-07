import admin from 'firebase-admin';

let initialized = false;

export function initAdmin() {
  if (initialized || admin.apps.length) {
    initialized = true;
    return admin;
  }
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    console.warn('[initAdmin] FIREBASE_ADMIN_KEY is not set in environment');
    return admin;
  }
  try {
    let cleaned = raw.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    // Handle potential base64 encoded service account
    if (!cleaned.startsWith('{') && cleaned.length > 50) {
      try {
        const decodedStr = Buffer.from(cleaned, 'base64').toString('utf8');
        if (decodedStr.startsWith('{')) {
          cleaned = decodedStr;
        }
      } catch (_) {}
    }
    const sa = JSON.parse(cleaned);
    if (sa.private_key && sa.private_key.includes('\\n')) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://cowio-dfc77-default-rtdb.firebaseio.com',
    });
    initialized = true;
    console.log('[initAdmin] Firebase Admin successfully initialized for project:', sa.project_id);
  } catch (err) {
    console.error('[initAdmin] Firebase Admin Init Error:', err.message, err.stack);
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
