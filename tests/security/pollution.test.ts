import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';
import { sanitizeObject } from '../../utils/sanitize.js';

describe('Prototype Pollution Defense Tests', () => {
  it('should prevent Object prototype pollution from payload object', () => {
    const maliciousPayload = JSON.parse('{"__proto__": {"pollutedKey": "compromised"}}');
    const sanitized = sanitizeObject(maliciousPayload);

    expect((Object.prototype as any).pollutedKey).toBeUndefined();
    expect(sanitized).not.toHaveProperty('__proto__');
  });

  it('should strip prototype pollution keys in incoming express POST bodies', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"hacked":true}}');

    expect((Object.prototype as any).hacked).toBeUndefined();
    expect(({} as any).hacked).toBeUndefined();
  });
});
