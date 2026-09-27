import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/Config.js';
import { Role } from '../../src/enums/Role.js';
import { ErrorHandler } from '../../src/middleware/ErrorHandler.js';
import { authMiddleware } from '../../src/middleware/AuthMiddleware.js';
import { User } from '../../src/models/User.js';
import { ApiResponse } from '../../src/utils/ApiResponse.js';

const { requireAuth, requireRole } = authMiddleware;

// No production route is role-gated yet, so this builds a throwaway app around
// the real middleware exports: one route per role at /probe/<role>, plus one
// that admits either of two roles. Replace it with real role-gated routes once
// they exist.
const buildProbeApp = () => {
  const probe = express();

  for (const role of Object.values(Role)) {
    probe.get(`/probe/${role}`, requireAuth, requireRole(role), (req, res) => {
      ApiResponse.success(res, { role });
    });
  }

  probe.get(
    '/probe/district-or-dmc',
    requireAuth,
    requireRole(Role.DISTRICT_OFFICER, Role.DMC_OFFICER),
    (req, res) => {
      ApiResponse.success(res, { message: 'district or DMC officers' });
    },
  );

  probe.use(ErrorHandler.handle);

  return probe;
};

const signAccessToken = (id, role) =>
  jwt.sign({ id: id.toString(), role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

// Only citizens and community volunteers can register through the public API,
// so every role is created directly with the model - see server/README.md.
const accessTokenFor = async (role) => {
  const user = await User.create({
    name: `RBAC ${role}`,
    email: `rbac-${role}@example.com`,
    passwordHash: 'not-a-real-hash',
    role,
  });

  return signAccessToken(user.id, role);
};

const getAs = (probe, path, token) =>
  request(probe).get(path).set('Authorization', `Bearer ${token}`);

describe('requireRole — role-based access', () => {
  const probe = buildProbeApp();

  it('refuses a request with no token with 401', async () => {
    const res = await request(probe).get(`/probe/${Role.CITIZEN}`);

    expect(res.status).toBe(401);
  });

  it.each(Object.values(Role))('admits a %s on its own role route', async (role) => {
    const token = await accessTokenFor(role);

    const res = await getAs(probe, `/probe/${role}`, token);

    expect(res.status).toBe(200);
  });

  describe('a subclass inherits its parent role', () => {
    it('admits a community volunteer on a citizen route', async () => {
      const token = await accessTokenFor(Role.COMMUNITY_VOLUNTEER);

      const res = await getAs(probe, `/probe/${Role.CITIZEN}`, token);

      expect(res.status).toBe(200);
    });

    it('admits a duty officer on a DMC officer route', async () => {
      const token = await accessTokenFor(Role.DUTY_OFFICER);

      const res = await getAs(probe, `/probe/${Role.DMC_OFFICER}`, token);

      expect(res.status).toBe(200);
    });
  });

  describe('a parent does not inherit its subclass role', () => {
    it('refuses a citizen on a community volunteer route with 403', async () => {
      const token = await accessTokenFor(Role.CITIZEN);

      const res = await getAs(probe, `/probe/${Role.COMMUNITY_VOLUNTEER}`, token);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('refuses a DMC officer on a duty officer route with 403', async () => {
      const token = await accessTokenFor(Role.DMC_OFFICER);

      const res = await getAs(probe, `/probe/${Role.DUTY_OFFICER}`, token);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  it.each([
    [Role.DISTRICT_OFFICER, Role.DMC_OFFICER],
    [Role.RESCUE_TEAM_LEAD, Role.CITIZEN],
    [Role.CITIZEN, Role.DMC_OFFICER],
    [Role.COMMUNITY_VOLUNTEER, Role.DUTY_OFFICER],
    [Role.DUTY_OFFICER, Role.DISTRICT_OFFICER],
  ])('refuses a %s on an unrelated %s route with 403', async (role, routeRole) => {
    const token = await accessTokenFor(role);

    const res = await getAs(probe, `/probe/${routeRole}`, token);

    expect(res.status).toBe(403);
  });

  describe('a route that admits several roles', () => {
    it('admits a subclass of any of them', async () => {
      const token = await accessTokenFor(Role.DUTY_OFFICER);

      const res = await getAs(probe, '/probe/district-or-dmc', token);

      expect(res.status).toBe(200);
    });

    it('refuses a role that is none of them with 403', async () => {
      const token = await accessTokenFor(Role.CITIZEN);

      const res = await getAs(probe, '/probe/district-or-dmc', token);

      expect(res.status).toBe(403);
    });
  });

  // An account whose role no Person class stands for - such as one created
  // before the current roles - must be refused, not crash the check. Inserted
  // through the raw collection because the schema would reject the role.
  it('refuses an account with a role that no longer exists with 403', async () => {
    const { insertedId } = await User.collection.insertOne({
      name: 'Former Role',
      email: 'rbac-former-role@example.com',
      passwordHash: 'not-a-real-hash',
      role: 'former_role',
      isActive: true,
    });
    const token = signAccessToken(insertedId, 'former_role');

    const res = await getAs(probe, `/probe/${Role.CITIZEN}`, token);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('throws when a route is declared with an unknown role', () => {
    expect(() => requireRole('typo')).toThrow('Unknown role "typo"');
  });
});
