import request from 'supertest';
import app from '../../src/app.js';

const validPassword = 'Password123!';
const registeredEmail = 'login-user@example.com';

const registerUser = () =>
  request(app).post('/api/auth/register').send({
    email: registeredEmail,
    password: validPassword,
    role: 'seeker',
  });

describe('POST /api/auth/login', () => {
  it('logs in successfully and returns both tokens', async () => {
    await registerUser();

    const res = await request(app).post('/api/auth/login').send({
      email: registeredEmail,
      password: validPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password with 401', async () => {
    await registerUser();

    const res = await request(app).post('/api/auth/login').send({
      email: registeredEmail,
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: validPassword,
    });

    expect(res.status).toBe(401);
  });

  it('returns the same message for a wrong password and an unknown email', async () => {
    await registerUser();

    const wrongPasswordRes = await request(app).post('/api/auth/login').send({
      email: registeredEmail,
      password: 'WrongPassword123!',
    });

    const unknownEmailRes = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: validPassword,
    });

    expect(wrongPasswordRes.body.error.message).toEqual(expect.any(String));
    expect(wrongPasswordRes.body.error.message).toBe(unknownEmailRes.body.error.message);
  });
});
