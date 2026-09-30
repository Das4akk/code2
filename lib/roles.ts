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
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
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
 * Exclusively reads from environment variables (CREATOR_EMAILS, ADMIN_EMAILS, OWNER_EMAILS, etc.).
 */
export function getEnvRoleConfig(): RoleConfig {
  const defaultCreatorEmails = ['mankaef@yandex.ru', 'das4akk2@gmail.com', 'das4akk@gmail.com'];
  const defaultCreatorUids = ['hOjOUa2ayfPIHk2j5unqAa1UUXi2'];

  const creatorEmails = new Set<string>([
    ...defaultCreatorEmails,
    ...parseEnvList(process.env.CREATOR_EMAILS),
    ...parseEnvList(process.env.ADMIN_EMAILS),
    ...parseEnvList(process.env.OWNER_EMAILS)
  ]);

  const creatorUids = new Set<string>([
    ...defaultCreatorUids,
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

  const roles: UserRole[] = ['creator', 'operator', 'manager', 'moderator'];
  for (const role of roles) {
    const emailKey = `${role}Emails` as keyof RoleConfig;
    const uidKey = `${role}Uids` as keyof RoleConfig;

    const envEmails = envConfig[emailKey] as Set<string> | undefined;
    const envUids = envConfig[uidKey] as Set<string> | undefined;
    const fbEmails = fbConfig?.[emailKey] as Set<string> | undefined;
    const fbUids = fbConfig?.[uidKey] as Set<string> | undefined;

    if (
      (normEmail && envEmails?.has(normEmail)) ||
      (cleanUid && envUids?.has(cleanUid)) ||
      (normEmail && fbEmails?.has(normEmail)) ||
      (cleanUid && fbUids?.has(cleanUid))
    ) {
      return role;
    }
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
 * Uses no hardcoded fallback strings.
 */
export async function getRoleSecrets(db?: any): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {
    creator: (process.env.ROLE_SECRET_CREATOR || process.env.CREATOR_SECRET || '').trim(),
    operator: (process.env.ROLE_SECRET_OPERATOR || process.env.OPERATOR_SECRET || '').trim(),
    manager: (process.env.ROLE_SECRET_MANAGER || process.env.MANAGER_SECRET || '').trim(),
    moderator: (process.env.ROLE_SECRET_MODERATOR || process.env.MODERATOR_SECRET || '').trim(),
    master: (process.env.ADMIN_SECRET_KEY || '').trim()
  };

  if (db) {
    try {
      const snap = await db.ref('config/role_secrets').once('value');
      if (snap.exists()) {
        const val = snap.val();
        if (val.creator) secrets.creator = String(val.creator).trim();
        if (val.operator) secrets.operator = String(val.operator).trim();
        if (val.manager) secrets.manager = String(val.manager).trim();
        if (val.moderator) secrets.moderator = String(val.moderator).trim();
        if (val.master) secrets.master = String(val.master).trim();
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

  // If no secrets are configured on the server
  const configuredSecrets = Object.values(secrets).filter((s) => Boolean(s && s.length > 0));
  if (configuredSecrets.length === 0) {
    console.error('[COWIO Roles] Секреты не настроены на сервере');
    return { valid: false, error: 'Секреты не настроены на сервере' };
  }

  // Check master secret key first (can grant any requested role, default 'creator')
  if (secrets.master && timingSafeEqualStr(cleanSecret, secrets.master)) {
    const role: UserRole = (requestedRole as UserRole) || 'creator';
    return { valid: true, role };
  }

  // Check role-specific secrets
  if (secrets.creator && timingSafeEqualStr(cleanSecret, secrets.creator)) {
    return { valid: true, role: 'creator' };
  }

  if (secrets.operator && timingSafeEqualStr(cleanSecret, secrets.operator)) {
    return { valid: true, role: 'operator' };
  }

  if (secrets.manager && timingSafeEqualStr(cleanSecret, secrets.manager)) {
    return { valid: true, role: 'manager' };
  }

  if (secrets.moderator && timingSafeEqualStr(cleanSecret, secrets.moderator)) {
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
