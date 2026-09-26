import request from 'supertest';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';

const validPassword = 'Password123!';

const containsPasswordHash = (value) => {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(
    ([key, val]) => key === 'passwordHash' || containsPasswordHash(val),
  );
};

const erroredFields = (res) => res.body.error.errors.map(({ field }) => field);

describe('POST /api/auth/register', () => {
  it('registers a citizen successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Nimal Perera',
      email: 'citizen@example.com',
      password: validPassword,
      role: Role.CITIZEN,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.name).toBe('Nimal Perera');
    expect(res.body.data.user.email).toBe('citizen@example.com');
    expect(res.body.data.user.role).toBe(Role.CITIZEN);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('registers a community volunteer successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Kamala Fernando',
      email: 'volunteer@example.com',
      password: validPassword,
      role: Role.COMMUNITY_VOLUNTEER,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.name).toBe('Kamala Fernando');
    expect(res.body.data.user.email).toBe('volunteer@example.com');
    expect(res.body.data.user.role).toBe(Role.COMMUNITY_VOLUNTEER);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it.each([Role.DMC_OFFICER, Role.DUTY_OFFICER, Role.DISTRICT_OFFICER, Role.RESCUE_TEAM_LEAD])(
    'rejects a role of %s with 400 - it can only be seeded',
    async (role) => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Wannabe Officer',
          email: `wannabe-${role}@example.com`,
          password: validPassword,
          role,
        });

      expect(res.status).toBe(400);
      expect(erroredFields(res)).toContain('role');
    },
  );

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First Person',
      email: 'duplicate@example.com',
      password: validPassword,
      role: Role.CITIZEN,
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Second Person',
      email: 'duplicate@example.com',
      password: validPassword,
      role: Role.COMMUNITY_VOLUNTEER,
    });

    expect(res.status).toBe(409);
  });

  it('rejects a missing name with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'no-name@example.com',
      password: validPassword,
      role: Role.CITIZEN,
    });

    expect(res.status).toBe(400);
    expect(erroredFields(res)).toContain('name');
  });

  it('rejects a name that is only whitespace with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: '   ',
      email: 'blank-name@example.com',
      password: validPassword,
      role: Role.CITIZEN,
    });

    expect(res.status).toBe(400);
    expect(erroredFields(res)).toContain('name');
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Short Password',
      email: 'short-password@example.com',
      password: 'short1',
      role: Role.CITIZEN,
    });

    expect(res.status).toBe(400);
  });

  it('never includes a password hash in the response', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'No Hash',
      email: 'no-hash@example.com',
      password: validPassword,
      role: Role.CITIZEN,
    });

    expect(res.status).toBe(201);
    expect(containsPasswordHash(res.body)).toBe(false);
  });
});
