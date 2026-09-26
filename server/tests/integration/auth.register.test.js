import request from 'supertest';
import app from '../../src/app.js';

const validPassword = 'Password123!';

const containsPasswordHash = (value) => {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(
    ([key, val]) => key === 'passwordHash' || containsPasswordHash(val),
  );
};

describe('POST /api/auth/register', () => {
  it('registers a seeker successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'seeker@example.com',
      password: validPassword,
      role: 'seeker',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('seeker@example.com');
    expect(res.body.data.user.role).toBe('seeker');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('registers a business successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'business@example.com',
      password: validPassword,
      role: 'business',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('business@example.com');
    expect(res.body.data.user.role).toBe('business');
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: validPassword,
      role: 'seeker',
    });

    const res = await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: validPassword,
      role: 'business',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a role of admin with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'wannabe-admin@example.com',
      password: validPassword,
      role: 'admin',
    });

    expect(res.status).toBe(400);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short-password@example.com',
      password: 'short1',
      role: 'seeker',
    });

    expect(res.status).toBe(400);
  });

  it('never includes a password hash in the response', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'no-hash@example.com',
      password: validPassword,
      role: 'seeker',
    });

    expect(res.status).toBe(201);
    expect(containsPasswordHash(res.body)).toBe(false);
  });
});
