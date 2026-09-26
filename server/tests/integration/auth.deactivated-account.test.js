import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/user.model.js';

const validPassword = 'Password123!';

const registerUser = (email) =>
  request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'seeker',
  });

const deactivate = (email) => User.updateOne({ email }, { isActive: false });

describe('POST /api/auth/login — deactivated account', () => {
  it('rejects correct credentials with 403 ACCOUNT_DEACTIVATED', async () => {
    const email = 'login-deactivated@example.com';
    await registerUser(email);
    await deactivate(email);

    const res = await request(app).post('/api/auth/login').send({ email, password: validPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('still rejects a wrong password for a deactivated account with 401 INVALID_CREDENTIALS, not 403', async () => {
    const email = 'login-deactivated-wrong-password@example.com';
    await registerUser(email);
    await deactivate(email);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('leaves an active account able to log in', async () => {
    const email = 'login-still-active@example.com';
    await registerUser(email);

    const res = await request(app).post('/api/auth/login').send({ email, password: validPassword });

    expect(res.status).toBe(200);
  });
});

describe('requireAuth — deactivated account', () => {
  it('refuses a still-valid access token with 401 once the user is deactivated', async () => {
    const email = 'requireauth-deactivated@example.com';
    const { body } = await registerUser(email);

    await deactivate(email);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('leaves an active account able to use its access token', async () => {
    const email = 'requireauth-still-active@example.com';
    const { body } = await registerUser(email);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.accessToken}`);

    expect(res.status).toBe(200);
  });
});
