import request from 'supertest';
import { app } from '../../src/core/App.js';
import { User } from '../../src/models/User.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';

const validPassword = 'Password123!';

const registerCitizen = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test Citizen', email, password: validPassword, role: 'citizen' });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const deactivate = (accessToken) =>
  request(app).post('/api/auth/deactivate').set('Authorization', `Bearer ${accessToken}`);

describe('isActive defaults to true', () => {
  it('is true on a newly registered user in the database, and never in the response', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Citizen',
      email: 'deactivate-flag-default@example.com',
      password: validPassword,
      role: 'citizen',
    });

    expect(res.body.data.user).not.toHaveProperty('isActive');

    const stored = await User.findById(res.body.data.user.id).lean();
    expect(stored.isActive).toBe(true);
  });
});

describe('POST /api/auth/deactivate', () => {
  it('sets isActive to false for the caller only', async () => {
    const caller = await registerCitizen('deactivate-caller@example.com');
    const other = await registerCitizen('deactivate-bystander@example.com');

    const res = await deactivate(caller.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });

    const callerUser = await User.findById(caller.userId).lean();
    const otherUser = await User.findById(other.userId).lean();
    expect(callerUser.isActive).toBe(false);
    expect(otherUser.isActive).toBe(true);
  });

  it('revokes every refresh token belonging to the user, and none for anyone else', async () => {
    const email = 'deactivate-multi-session@example.com';
    const first = await registerCitizen(email);
    const secondLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: validPassword });

    const other = await registerCitizen('deactivate-other-session@example.com');

    expect(await RefreshToken.countDocuments({ user: first.userId })).toBe(2);

    await deactivate(first.accessToken);

    expect(await RefreshToken.countDocuments({ user: first.userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ user: other.userId })).toBe(1);

    void secondLogin;
  });

  it('rejects a guest with 401', async () => {
    const res = await request(app).post('/api/auth/deactivate');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login — deactivated account', () => {
  it('refuses correct credentials with 403 ACCOUNT_DEACTIVATED', async () => {
    const email = 'deactivate-login@example.com';
    const user = await registerCitizen(email);
    await deactivate(user.accessToken);

    const res = await request(app).post('/api/auth/login').send({ email, password: validPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});

describe('requireAuth — deactivated account', () => {
  it('refuses a still-valid access token with 401 once the account is deactivated', async () => {
    const user = await registerCitizen('deactivate-live-token@example.com');
    const staleAccessToken = user.accessToken;

    await deactivate(user.accessToken);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${staleAccessToken}`);

    expect(res.status).toBe(401);
  });
});
