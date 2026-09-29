import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('Rate Limiting Defense Tests', () => {
  it('should return 429 after 5 requests to /api/custom-auth/verify-code', async () => {
    const testEmail = 'ratelimit-target@example.com';
    let lastStatus = 0;

    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/custom-auth/verify-code')
        .send({ email: testEmail, code: '123456' });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});
