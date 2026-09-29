import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('CORS Whitelist Defense Tests', () => {
  it('should block requests with unauthorized Origin: https://evil.com', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.com');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow requests with whitelisted Origin: https://cowio.ru', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://cowio.ru');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://cowio.ru');
  });
});
