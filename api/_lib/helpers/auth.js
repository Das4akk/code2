import { getAuth, getDb } from './firebase.js';

const DEFAULT_CREATOR_EMAILS = [
  'mankaef@yandex.ru',
  'das4akk@gmail.com',
  'das4akk2@gmail.com',
  'cowiosupport@gmail.com'
];

const CREATOR_EMAILS = [
  ...DEFAULT_CREATOR_EMAILS,
  ...(process.env.CREATOR_EMAILS || '').split(/[,;\s]+/)
]
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const OWNER_EMAILS = (process.env.OWNER_EMAILS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const CREATOR_UIDS = (process.env.CREATOR_UIDS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

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

export function getRoleFromEnv(uid, email) {
  const normEmail = (email || '').toLowerCase().trim();
  const cleanUid = (uid || '').trim();
  if (
    CREATOR_EMAILS.includes(normEmail) ||
    ADMIN_EMAILS.includes(normEmail) ||
    OWNER_EMAILS.includes(normEmail) ||
    CREATOR_UIDS.includes(cleanUid) ||
    ADMIN_UIDS.includes(cleanUid)
  ) {
    return 'creator';
  }
  return 'user';
}

export async function verifyToken(req) {
  const authHeader = req.headers?.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!idToken) return null;
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (e) {
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
  const isEnvAdmin = getRoleFromEnv(decoded.uid, decoded.email) === 'creator';
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
  const isEnvCreator = getRoleFromEnv(decoded.uid, decoded.email) === 'creator';
  if (isEnvCreator) return decoded;

  try {
    const snap = await getDb().ref(`admins/${decoded.uid}`).once('value');
    if (snap.exists()) return decoded;
  } catch (e) {}

  return null;
}
