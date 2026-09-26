import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';

const validPassword = 'Password123!';
const newValidPassword = 'NewPassword456!';

const registerSeeker = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'seeker' });

  return res.body.data;
};

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

const changePassword = (accessToken, body) =>
  request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);

const refresh = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });

// JWTs here carry only second-resolution `iat`/`exp` claims, so two tokens
// signed for the same user inside the same second are byte-identical and
// would defeat a same-vs-different-token assertion; this forces the clock
// tick a session apart.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const signExpiredAccessToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: -10 });

describe('POST /api/auth/change-password — happy path', () => {
  it('accepts the correct current password and a valid new one, then lets the new password sign in and the old one fail', async () => {
    const email = 'change-password-happy@example.com';
    const { accessToken } = await registerSeeker(email);

    const res = await changePassword(accessToken, {
      currentPassword: validPassword,
      newPassword: newValidPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));

    const newLoginRes = await login(email, newValidPassword);
    expect(newLoginRes.status).toBe(200);

    const oldLoginRes = await login(email, validPassword);
    expect(oldLoginRes.status).toBe(401);
  });
});

describe('POST /api/auth/change-password — wrong current password', () => {
  it('refuses with 401 INVALID_CURRENT_PASSWORD and leaves the stored hash unchanged', async () => {
    const email = 'change-password-wrong-current@example.com';
    const { accessToken } = await registerSeeker(email);

    const res = await changePassword(accessToken, {
      currentPassword: 'NotTheRealPassword1!',
      newPassword: newValidPassword,
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const stillOriginalRes = await login(email, validPassword);
    expect(stillOriginalRes.status).toBe(200);
  });
});

describe('POST /api/auth/change-password — validation', () => {
  it('refuses a new password below the registration minimum length with 400 and a field error', async () => {
    const { accessToken } = await registerSeeker('change-password-too-short@example.com');

    const res = await changePassword(accessToken, {
      currentPassword: validPassword,
      newPassword: 'short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'newPassword' })]),
    );
  });

  it('refuses a missing field with 400 and a field error', async () => {
    const { accessToken } = await registerSeeker('change-password-missing-field@example.com');

    const res = await changePassword(accessToken, { newPassword: newValidPassword });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'currentPassword' })]),
    );
  });

  it('refuses a new password identical to the current one with 400 PASSWORD_UNCHANGED', async () => {
    const { accessToken } = await registerSeeker('change-password-unchanged@example.com');

    const res = await changePassword(accessToken, {
      currentPassword: validPassword,
      newPassword: validPassword,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PASSWORD_UNCHANGED');
  });
});

describe('POST /api/auth/change-password — other-session revocation', () => {
  it('revokes every other refresh token while the acting device keeps its session', async () => {
    const email = 'change-password-revocation@example.com';
    const { accessToken: firstAccessToken } = await registerSeeker(email);

    const secondLoginRes = await login(email, validPassword);
    const secondRefreshToken = secondLoginRes.body.data.refreshToken;

    await wait(1100);

    const changeRes = await changePassword(firstAccessToken, {
      currentPassword: validPassword,
      newPassword: newValidPassword,
    });
    expect(changeRes.status).toBe(200);
    const actingDeviceRefreshToken = changeRes.body.data.refreshToken;
    expect(actingDeviceRefreshToken).not.toBe(secondRefreshToken);

    const secondDeviceRefreshRes = await refresh(secondRefreshToken);
    expect(secondDeviceRefreshRes.status).toBe(401);

    const actingDeviceRefreshRes = await refresh(actingDeviceRefreshToken);
    expect(actingDeviceRefreshRes.status).toBe(200);
    expect(actingDeviceRefreshRes.body.data.accessToken).toEqual(expect.any(String));
  });
});

describe('POST /api/auth/change-password — access token failures', () => {
  it('rejects an absent access token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: validPassword, newPassword: newValidPassword });

    expect(res.status).toBe(401);
  });

  it('rejects a malformed access token with 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .send({ currentPassword: validPassword, newPassword: newValidPassword });

    expect(res.status).toBe(401);
  });

  it('rejects an expired access token with 401 and the expiry-specific error code', async () => {
    const { user } = await registerSeeker('change-password-expired-token@example.com');
    const expiredToken = signExpiredAccessToken(user);

    const res = await changePassword(expiredToken, {
      currentPassword: validPassword,
      newPassword: newValidPassword,
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});
