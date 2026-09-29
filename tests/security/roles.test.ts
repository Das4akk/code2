import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnvRoleConfig, getRoleSecrets, verifyRoleSecret, resolveAutoRole } from '../../lib/roles';

describe('Role System Security Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CREATOR_EMAILS;
    delete process.env.ADMIN_EMAILS;
    delete process.env.OWNER_EMAILS;
    delete process.env.CREATOR_UIDS;
    delete process.env.ADMIN_UIDS;
    delete process.env.OPERATOR_EMAILS;
    delete process.env.OPERATOR_UIDS;
    delete process.env.MANAGER_EMAILS;
    delete process.env.MANAGER_UIDS;
    delete process.env.MODERATOR_EMAILS;
    delete process.env.MODERATOR_UIDS;
    delete process.env.ROLE_SECRET_CREATOR;
    delete process.env.ROLE_SECRET_OPERATOR;
    delete process.env.ROLE_SECRET_MANAGER;
    delete process.env.ROLE_SECRET_MODERATOR;
    delete process.env.ADMIN_SECRET_KEY;
    delete process.env.CREATOR_SECRET;
    delete process.env.OPERATOR_SECRET;
    delete process.env.MANAGER_SECRET;
    delete process.env.MODERATOR_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should NOT contain hardcoded creator emails by default', () => {
    const config = getEnvRoleConfig();
    expect(config.creatorEmails.has('das4akk2@gmail.com')).toBe(false);
    expect(config.creatorEmails.size).toBe(0);
  });

  it('should populate creator, operator, manager, moderator from ENV', () => {
    process.env.CREATOR_EMAILS = 'lead@cowio.ru, founder@cowio.ru';
    process.env.OPERATOR_EMAILS = 'support@cowio.ru';
    process.env.MANAGER_EMAILS = 'manager@cowio.ru';
    process.env.MODERATOR_EMAILS = 'mod@cowio.ru';

    const config = getEnvRoleConfig();
    expect(config.creatorEmails.has('lead@cowio.ru')).toBe(true);
    expect(config.creatorEmails.has('founder@cowio.ru')).toBe(true);
    expect(config.operatorEmails.has('support@cowio.ru')).toBe(true);
    expect(config.managerEmails.has('manager@cowio.ru')).toBe(true);
    expect(config.moderatorEmails.has('mod@cowio.ru')).toBe(true);
  });

  it('should resolve roles correctly based on priority', async () => {
    process.env.CREATOR_EMAILS = 'creator@example.com';
    process.env.MODERATOR_EMAILS = 'mod@example.com';

    const roleCreator = await resolveAutoRole('uid_1', 'creator@example.com');
    expect(roleCreator).toBe('creator');

    const roleMod = await resolveAutoRole('uid_2', 'mod@example.com');
    expect(roleMod).toBe('moderator');

    const roleNormal = await resolveAutoRole('uid_3', 'random@example.com');
    expect(roleNormal).toBe(null);
  });

  it('should return error when no secrets are configured on server', async () => {
    const secrets = await getRoleSecrets();
    expect(secrets.creator).toBe('');
    expect(secrets.operator).toBe('');
    expect(secrets.manager).toBe('');
    expect(secrets.moderator).toBe('');
    expect(secrets.master).toBe('');

    const res = await verifyRoleSecret('any_secret', 'creator');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Секреты не настроены на сервере');
  });

  it('should safely verify valid and invalid secret keys when configured', async () => {
    process.env.ROLE_SECRET_MODERATOR = 'secret-mod-code-123';
    process.env.ROLE_SECRET_CREATOR = 'secret-creator-code-456';

    const validMod = await verifyRoleSecret('secret-mod-code-123', 'moderator');
    expect(validMod.valid).toBe(true);
    expect(validMod.role).toBe('moderator');

    const validCreator = await verifyRoleSecret('secret-creator-code-456', 'creator');
    expect(validCreator.valid).toBe(true);
    expect(validCreator.role).toBe('creator');

    const invalid = await verifyRoleSecret('wrong-secret', 'moderator');
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBe('Неверный секретный ключ');
  });
});
