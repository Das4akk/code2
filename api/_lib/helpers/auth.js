import { getAuth, getDb } from './firebase.js';

const CREATOR_EMAILS = new Set(
  (process.env.CREATOR_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const CREATOR_UIDS = new Set(
  (process.env.CREATOR_UIDS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
);

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const ADMIN_UIDS = new Set(
  (process.env.ADMIN_UIDS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
);

console.log('[whitelist] CREATOR_EMAILS count:', CREATOR_EMAILS.size, 'CREATOR_UIDS count:', CREATOR_UIDS.size);
console.log('[whitelist] CREATOR_EMAILS values:', Array.from(CREATOR_EMAILS));

// Fail-safe: если ENV не настроены — логируем предупреждение, но не падаем
if (CREATOR_EMAILS.size === 0 && CREATOR_UIDS.size === 0) {
  console.warn('[SECURITY] CREATOR_EMAILS и CREATOR_UIDS не заданы в ENV. Только /admins/{uid} даёт права.');
}

export function isInCreatorWhitelist(uid, email) {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanUid = (uid || '').trim();
  return CREATOR_EMAILS.has(normEmail) || CREATOR_UIDS.has(cleanUid);
}

export function isInAdminWhitelist(uid, email) {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanUid = (uid || '').trim();
  return ADMIN_EMAILS.has(normEmail) || ADMIN_UIDS.has(cleanUid);
}

export function getRoleFromEnv(uid, email) {
  if (isInCreatorWhitelist(uid, email)) return 'creator';
  if (isInAdminWhitelist(uid, email)) return 'admin';
  return 'user';
}

const ALLOWED_ORIGINS = [
  'https://cowio.vercel.app',
  'https://cowio.ru',
  'https://www.cowio.ru',
  'http://localhost:3000',
  'http://localhost:5173'
];

export function setCors(req, res) {
  const origin = req.headers?.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app') || origin.includes('googleusercontent.com') || origin.includes('run.app'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
}

export async function verifyToken(req) {
  const authHeader = req.headers?.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!idToken) {
    console.warn('[verifyToken] No Bearer token');
    return null;
  }
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    console.log('[verifyToken] OK uid=' + decoded.uid + ' email=' + decoded.email);
    return decoded;
  } catch (e) {
    console.error('[verifyToken] FAILED:', e.code || e.message, e.stack);
    return null;
  }
}

export async function requireAuth(req) {
  const decoded = await verifyToken(req);
  if (!decoded) return null;
  return decoded;
}

export async function requireAdmin(req) {
  const decoded = await verifyToken(req);
  if (!decoded) return null;
  const isEnvAdmin = isInCreatorWhitelist(decoded.uid, decoded.email) || isInAdminWhitelist(decoded.uid, decoded.email);
  if (isEnvAdmin) return decoded;

  try {
    const snap = await getDb().ref(`admins/${decoded.uid}`).once('value');
    if (snap.exists()) return decoded;
  } catch (e) {}

  return null;
}

export async function requireCreator(req) {
  const decoded = await verifyToken(req);
  if (!decoded) return null;
  const isEnvCreator = isInCreatorWhitelist(decoded.uid, decoded.email);
  if (isEnvCreator) return decoded;

  try {
    const snap = await getDb().ref(`admins/${decoded.uid}`).once('value');
    if (snap.exists()) {
      const data = snap.val();
      if (data?.role === 'creator' || data?.isOwner === true) return decoded;
    }
  } catch (e) {}

  return null;
}
