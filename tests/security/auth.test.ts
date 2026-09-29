import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('API Authentication Defense Tests', () => {
  it('should return 401 when POST /api/premium/create-payment is called without Bearer token', async () => {
    const res = await request(app)
      .post('/api/premium/create-payment')
      .send({ plan: 'premium' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 when GET /api/auth/check-role is called without Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/check-role');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should allow /api/health without authentication', async () => {
    const res = await request(app)
      .get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
