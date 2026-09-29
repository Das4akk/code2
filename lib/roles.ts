import crypto from 'crypto';

export type UserRole = 'creator' | 'operator' | 'manager' | 'moderator' | 'user';

export interface RoleConfig {
  creatorEmails: Set<string>;
  creatorUids: Set<string>;
  operatorEmails: Set<string>;
  operatorUids: Set<string>;
  managerEmails: Set<string>;
  managerUids: Set<string>;
  moderatorEmails: Set<string>;
  moderatorUids: Set<string>;
}

export interface RoleClaimResult {
  valid: boolean;
  role?: UserRole;
  error?: string;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function parseEnvList(val?: string): string[] {
  if (!val) return [];
  return val
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns role configuration from environment variables.
 * Automatically includes default creator email 'das4akk2@gmail.com'.
 */
export function getEnvRoleConfig(): RoleConfig {
  const creatorEmails = new Set<string>([
    'das4akk2@gmail.com',
    ...parseEnvList(process.env.CREATOR_EMAILS),
    ...parseEnvList(process.env.ADMIN_EMAILS),
    ...parseEnvList(process.env.OWNER_EMAILS)
  ]);

  const creatorUids = new Set<string>([
    ...parseEnvList(process.env.CREATOR_UIDS),
    ...parseEnvList(process.env.ADMIN_UIDS)
  ]);

  const operatorEmails = new Set<string>(parseEnvList(process.env.OPERATOR_EMAILS));
  const operatorUids = new Set<string>(parseEnvList(process.env.OPERATOR_UIDS));

  const managerEmails = new Set<string>(parseEnvList(process.env.MANAGER_EMAILS));
  const managerUids = new Set<string>(parseEnvList(process.env.MANAGER_UIDS));

  const moderatorEmails = new Set<string>(parseEnvList(process.env.MODERATOR_EMAILS));
  const moderatorUids = new Set<string>(parseEnvList(process.env.MODERATOR_UIDS));

  return {
    creatorEmails,
    creatorUids,
    operatorEmails,
    operatorUids,
    managerEmails,
    managerUids,
    moderatorEmails,
    moderatorUids
  };
}

/**
 * Reads dynamic role configuration from Firebase Realtime Database (/config/roles).
 */
export async function getFirebaseRoleConfig(db: any): Promise<RoleConfig | null> {
  if (!db) return null;
  try {
    const snap = await db.ref('config/roles').once('value');
    if (!snap.exists()) return null;
    const val = snap.val();

    const extractList = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      if (typeof raw === 'string') return parseEnvList(raw);
      if (typeof raw === 'object') return Object.keys(raw).map((s) => s.trim().toLowerCase()).filter(Boolean);
      return [];
    };

    return {
      creatorEmails: new Set(extractList(val.creators || val.creator || val.creatorEmails)),
      creatorUids: new Set(extractList(val.creatorUids)),
      operatorEmails: new Set(extractList(val.operators || val.operator || val.operatorEmails)),
      operatorUids: new Set(extractList(val.operatorUids)),
      managerEmails: new Set(extractList(val.managers || val.manager || val.managerEmails)),
      managerUids: new Set(extractList(val.managerUids)),
      moderatorEmails: new Set(extractList(val.moderators || val.moderator || val.moderatorEmails)),
      moderatorUids: new Set(extractList(val.moderatorUids))
    };
  } catch (err: any) {
    console.warn('[COWIO Roles] Warning reading config/roles from Firebase:', err.message);
    return null;
  }
}

/**
 * Resolves whether the user automatically qualifies for a privileged role
 * based on their email or UID in environment variables or Firebase config.
 * Priority: creator > operator > manager > moderator.
 */
export async function resolveAutoRole(uid: string, email?: string, db?: any): Promise<UserRole | null> {
  const normEmail = (email || '').trim().toLowerCase();
  const cleanUid = (uid || '').trim();

  const envConfig = getEnvRoleConfig();
  let fbConfig: RoleConfig | null = null;
  if (db) {
    fbConfig = await getFirebaseRoleConfig(db);
  }

  // 1. Creator check
  if (
    (normEmail && envConfig.creatorEmails.has(normEmail)) ||
    (cleanUid && envConfig.creatorUids.has(cleanUid)) ||
    (normEmail && fbConfig?.creatorEmails.has(normEmail)) ||
    (cleanUid && fbConfig?.creatorUids.has(cleanUid))
  ) {
    return 'creator';
  }

  // 2. Operator check
  if (
    (normEmail && envConfig.operatorEmails.has(normEmail)) ||
    (cleanUid && envConfig.operatorUids.has(cleanUid)) ||
    (normEmail && fbConfig?.operatorEmails.has(normEmail)) ||
    (cleanUid && fbConfig?.operatorUids.has(cleanUid))
  ) {
    return 'operator';
  }

  // 3. Manager check
  if (
    (normEmail && envConfig.managerEmails.has(normEmail)) ||
    (cleanUid && envConfig.managerUids.has(cleanUid)) ||
    (normEmail && fbConfig?.managerEmails.has(normEmail)) ||
    (cleanUid && fbConfig?.managerUids.has(cleanUid))
  ) {
    return 'manager';
  }

  // 4. Moderator check
  if (
    (normEmail && envConfig.moderatorEmails.has(normEmail)) ||
    (cleanUid && envConfig.moderatorUids.has(cleanUid)) ||
    (normEmail && fbConfig?.moderatorEmails.has(normEmail)) ||
    (cleanUid && fbConfig?.moderatorUids.has(cleanUid))
  ) {
    return 'moderator';
  }

  return null;
}

/**
 * Writes/syncs role privileges to Firebase Realtime Database (/admins/{uid} and /users/{uid}/profile/role).
 */
export async function syncRoleToDatabase(
  db: any,
  uid: string,
  role: UserRole,
  userEmail?: string,
  grantedBy = 'auto_system'
): Promise<void> {
  if (!db || !uid || !role) return;

  const isOwner = role === 'creator';
  const adminRecord = {
    role,
    isOwner,
    email: userEmail || null,
    grantedAt: Date.now(),
    grantedBy
  };

  try {
    await Promise.all([
      db.ref(`admins/${uid}`).set(adminRecord),
      db.ref(`users/${uid}/profile/role`).set(role)
    ]);
    console.log(`[COWIO Roles] Successfully synced role '${role}' to UID: ${uid} (grantedBy: ${grantedBy})`);
  } catch (err: any) {
    console.error(`[COWIO Roles] Failed to write role to Firebase for UID ${uid}:`, err.message);
    throw err;
  }
}

/**
 * Retrieves configured role secret keys from environment variables and Firebase /config/role_secrets.
 */
export async function getRoleSecrets(db?: any): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {
    creator: process.env.ROLE_SECRET_CREATOR || process.env.CREATOR_SECRET || 'cowio-creator-master-secret-2026',
    operator: process.env.ROLE_SECRET_OPERATOR || process.env.OPERATOR_SECRET || 'cowio-operator-secret-2026',
    manager: process.env.ROLE_SECRET_MANAGER || process.env.MANAGER_SECRET || 'cowio-manager-secret-2026',
    moderator: process.env.ROLE_SECRET_MODERATOR || process.env.MODERATOR_SECRET || 'cowio-moderator-secret-2026',
    master: process.env.ADMIN_SECRET_KEY || 'cowio-admin-master-key-2026'
  };

  if (db) {
    try {
      const snap = await db.ref('config/role_secrets').once('value');
      if (snap.exists()) {
        const val = snap.val();
        if (val.creator) secrets.creator = String(val.creator);
        if (val.operator) secrets.operator = String(val.operator);
        if (val.manager) secrets.manager = String(val.manager);
        if (val.moderator) secrets.moderator = String(val.moderator);
        if (val.master) secrets.master = String(val.master);
      }
    } catch (err: any) {
      console.warn('[COWIO Roles] Warning reading config/role_secrets:', err.message);
    }
  }

  return secrets;
}

/**
 * Validates a submitted secret against configured role secrets using timing-safe comparisons.
 */
export async function verifyRoleSecret(
  secret: string,
  requestedRole?: string,
  db?: any
): Promise<RoleClaimResult> {
  const cleanSecret = String(secret || '').trim();
  if (!cleanSecret) {
    return { valid: false, error: 'Секретный ключ не указан' };
  }

  const secrets = await getRoleSecrets(db);

  // Check master secret key first (can grant any requested role, default 'creator')
  if (timingSafeEqualStr(cleanSecret, secrets.master)) {
    const role: UserRole = (requestedRole as UserRole) || 'creator';
    return { valid: true, role };
  }

  // Check role-specific secrets
  if (timingSafeEqualStr(cleanSecret, secrets.creator)) {
    return { valid: true, role: 'creator' };
  }

  if (timingSafeEqualStr(cleanSecret, secrets.operator)) {
    return { valid: true, role: 'operator' };
  }

  if (timingSafeEqualStr(cleanSecret, secrets.manager)) {
    return { valid: true, role: 'manager' };
  }

  if (timingSafeEqualStr(cleanSecret, secrets.moderator)) {
    return { valid: true, role: 'moderator' };
  }

  return { valid: false, error: 'Неверный секретный ключ' };
}

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  creator: 'Создатель (Полный доступ)',
  operator: 'Оператор поддержки',
  manager: 'Менеджер (Только просмотр)',
  moderator: 'Модератор комнат и контента',
  user: 'Пользователь'
};
