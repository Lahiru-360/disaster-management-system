import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';

const validPassword = 'Password123!';

const registerUser = (email) =>
  request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'seeker',
  });

const signExpiredAccessToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: -10 });

describe('GET /api/auth/me — token behaviour', () => {
  it('grants access with a valid access token', async () => {
    const { body } = await registerUser('token-valid@example.com');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('token-valid@example.com');
  });

  it('rejects a malformed token with 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt');

    expect(res.status).toBe(401);
  });

  it('rejects an expired token with 401 and the expiry-specific error code', async () => {
    const { body } = await registerUser('token-expired@example.com');
    const expiredToken = signExpiredAccessToken(body.data.user);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('POST /api/auth/refresh and /api/auth/logout', () => {
  it('yields a working new access token for a valid refresh token', async () => {
    const { body } = await registerUser('refresh-valid@example.com');

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: body.data.refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshRes.body.data.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe('refresh-valid@example.com');
  });

  it('rejects the same refresh token with 401 after logout', async () => {
    const { body } = await registerUser('logout@example.com');

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${body.data.accessToken}`)
      .send({ refreshToken: body.data.refreshToken });

    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: body.data.refreshToken });

    expect(refreshRes.status).toBe(401);
  });
});
