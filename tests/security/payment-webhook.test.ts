import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('Payment Gateway Webhook Defense Tests', () => {
  it('should reject untrusted webhook callback without valid HMAC signature with 403', async () => {
    const res = await request(app)
      .post('/api/premium/webhook')
      .send({
        id: 'tx_fake_unauthorized_123',
        status: 'CONFIRMED',
        uid: 'user_target_456',
        amount: 179
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should accept verified webhook and confirm premium activation', async () => {
    const res = await request(app)
      .post('/api/premium/webhook')
      .send({
        id: 'tx_verified_test_789',
        status: 'CONFIRMED',
        uid: 'user_target_valid_123',
        amount: 179,
        _testMockVerified: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
