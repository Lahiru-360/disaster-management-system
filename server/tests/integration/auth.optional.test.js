import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/Config.js';
import { Role } from '../../src/enums/Role.js';
import { ErrorHandler } from '../../src/middleware/ErrorHandler.js';
import { authMiddleware } from '../../src/middleware/AuthMiddleware.js';
import { User } from '../../src/models/User.js';
import { ApiResponse } from '../../src/utils/ApiResponse.js';

const { optionalAuth, requireRole } = authMiddleware;

// No production route chains optionalAuth -> requireRole, so this builds a
// throwaway app around the real middleware exports to exercise the chain
// directly.
const buildProbeApp = () => {
  const app = express();

  app.get('/probe', optionalAuth, (req, res) => {
    ApiResponse.success(res, { userId: req.user ? req.user.id : null });
  });

  app.get('/probe-officer', optionalAuth, requireRole(Role.DMC_OFFICER), (req, res) => {
    ApiResponse.success(res, { message: 'DMC officers only' });
  });

  app.use(ErrorHandler.handle);

  return app;
};

const createCitizen = (email) =>
  User.create({ name: 'Test Citizen', email, passwordHash: 'not-a-real-hash', role: Role.CITIZEN });

const signAccessToken = (user, overrides = {}) =>
  jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
    ...overrides,
  });

describe('optionalAuth', () => {
  const app = buildProbeApp();

  it('populates req.user for a valid token, exactly as requireAuth would', async () => {
    const user = await createCitizen('optional-valid@example.com');
    const token = signAccessToken(user);

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(user.id.toString());
  });

  it('continues with req.user undefined when there is no Authorization header', async () => {
    const res = await request(app).get('/probe');

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('continues with req.user undefined for a malformed header', async () => {
    const res = await request(app).get('/probe').set('Authorization', 'Token not-bearer');

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('continues with req.user undefined and never 401s for an expired token', async () => {
    const user = await createCitizen('optional-expired@example.com');
    const expiredToken = signAccessToken(user, { expiresIn: -10 });

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('continues with req.user undefined for a tampered/invalid token', async () => {
    const user = await createCitizen('optional-tampered@example.com');
    const token = signAccessToken(user);
    const tampered = `${token.slice(0, -1)}${token.slice(-1) === 'a' ? 'b' : 'a'}`;

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('continues with req.user undefined when the token user no longer exists', async () => {
    const user = await createCitizen('optional-deleted@example.com');
    const token = signAccessToken(user);
    await User.findByIdAndDelete(user.id);

    const res = await request(app).get('/probe').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBeNull();
  });

  it('still fails closed with 401 through requireRole when no token was presented', async () => {
    const res = await request(app).get('/probe-officer');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('still fails closed with 401 through requireRole for a guest-treated bad token', async () => {
    const res = await request(app).get('/probe-officer').set('Authorization', 'Bearer garbage');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
