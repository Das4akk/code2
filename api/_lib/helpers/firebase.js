import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

let appInstance = null;

export function initAdmin() {
  const apps = getApps();
  if (apps.length > 0) {
    appInstance = apps[0];
    return appInstance;
  }
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    console.warn('[initAdmin] FIREBASE_ADMIN_KEY is not set in environment');
    return null;
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
    appInstance = initializeApp({
      credential: cert(sa),
      databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://das4akk-1-default-rtdb.firebaseio.com',
    });
    console.log('[initAdmin] Firebase Admin successfully initialized for project:', sa.project_id);
    return appInstance;
  } catch (err) {
    console.error('[initAdmin] Firebase Admin Init Error:', err.message, err.stack);
    return null;
  }
}

export function getDb() {
  initAdmin();
  const apps = getApps();
  if (apps.length === 0) {
    return null;
  }
  return getDatabase(apps[0]);
}

export function getAuth() {
  initAdmin();
  const apps = getApps();
  if (apps.length === 0) {
    return null;
  }
  return getAdminAuth(apps[0]);
}

export default {
  initAdmin,
  getDb,
  getAuth,
};
