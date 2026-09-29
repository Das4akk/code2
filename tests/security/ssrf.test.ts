import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('SSRF Vulnerability Defense Tests', () => {
  it('should block cloud metadata IP (169.254.169.254) with 400', async () => {
    const res = await request(app)
      .post('/api/video/info')
      .send({ url: 'http://169.254.169.254/' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should block loopback localhost address with 400', async () => {
    const res = await request(app)
      .post('/api/video/info')
      .send({ url: 'http://localhost:8080/admin' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should block private IPv4 subnet (192.168.1.1) with 400', async () => {
    const res = await request(app)
      .post('/api/video/info')
      .send({ url: 'http://192.168.1.1/secret' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should block resolve-media with private IP', async () => {
    const res = await request(app)
      .post('/api/resolve-media')
      .send({ url: 'http://127.0.0.1:3000/api/health' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
