import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../src/middleware/auth.middleware.js';
import { User } from '../../src/models/user.model.js';
import { sendSuccess } from '../../src/utils/response.js';

const validPassword = 'Password123!';

// No production route is role-gated yet, so this builds a throwaway app around
// the real middleware exports. Replace it with a real role-gated route once one
// exists.
const buildProbeApp = () => {
  const probe = express();

  probe.get('/probe-admin', requireAuth, requireRole('admin'), (req, res) => {
    sendSuccess(res, { message: 'admin only' });
  });

  probe.use(errorHandler);

  return probe;
};

const registerSeeker = async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: 'rbac-seeker@example.com',
    password: validPassword,
    role: 'seeker',
  });

  return res.body.data.accessToken;
};

// Admin accounts are never created through public registration (it rejects role: "admin"),
// only via direct database access — see server/README.md.
const createAdminAccessToken = async () => {
  const admin = await User.create({
    email: 'rbac-admin@example.com',
    passwordHash: 'not-a-real-hash',
    role: 'admin',
  });

  return jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
};

describe('requireRole — role-based access', () => {
  const probe = buildProbeApp();

  it('refuses a request with no token with 401', async () => {
    const res = await request(probe).get('/probe-admin');

    expect(res.status).toBe(401);
  });

  it('refuses a seeker token with 403', async () => {
    const seekerToken = await registerSeeker();

    const res = await request(probe)
      .get('/probe-admin')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(res.status).toBe(403);
  });

  it('allows an admin token with 200', async () => {
    const adminToken = await createAdminAccessToken();

    const res = await request(probe)
      .get('/probe-admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
