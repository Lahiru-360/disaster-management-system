import request from 'supertest';
import { app } from '../../src/core/App.js';
import { User } from '../../src/models/User.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { PasswordResetToken } from '../../src/models/PasswordResetToken.js';
import { AuthService } from '../../src/services/AuthService.js';
import { emailService } from '../../src/services/EmailService.js';

const validPassword = 'Password123!';
const newValidPassword = 'NewPassword456!';

const registerCitizen = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test Citizen', email, password: validPassword, role: 'citizen' });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

const forgotPassword = (email) => request(app).post('/api/auth/forgot-password').send({ email });

const resetPassword = (token, newPassword) =>
  request(app).post('/api/auth/reset-password').send({ token, newPassword });

// The raw token only ever exists in the link inside the recorded email — the
// stored PasswordResetToken row holds only its hash — so tests recover it by
// reading the no-op transport's recorded message rather than the database.
const extractResetToken = () => {
  const [message] = emailService.transport.getSentEmails();
  const match = message.text.match(/token=([^\s]+)/);
  return match[1];
};

describe('POST /api/auth/forgot-password — anti-enumeration', () => {
  it('returns an identical 200 response for a known, an unknown and a deactivated address', async () => {
    const email = 'forgot-known@example.com';
    await registerCitizen(email);

    const deactivatedEmail = 'forgot-deactivated@example.com';
    await registerCitizen(deactivatedEmail);
    await User.updateOne({ email: deactivatedEmail }, { isActive: false });

    const knownRes = await forgotPassword(email);
    const unknownRes = await forgotPassword('forgot-unknown@example.com');
    const deactivatedRes = await forgotPassword(deactivatedEmail);

    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
    expect(deactivatedRes.status).toBe(200);
    expect(knownRes.body).toEqual(unknownRes.body);
    expect(knownRes.body).toEqual(deactivatedRes.body);
  });

  it('refuses a missing or invalid email with 400 VALIDATION_ERROR', async () => {
    const res = await forgotPassword('not-an-email');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });
});

describe('POST /api/auth/forgot-password — email recorded only for a known active address', () => {
  beforeEach(() => emailService.transport.clearSentEmails());

  it('records exactly one email, for the known active address', async () => {
    const email = 'forgot-email-known@example.com';
    await registerCitizen(email);

    const deactivatedEmail = 'forgot-email-deactivated@example.com';
    await registerCitizen(deactivatedEmail);
    await User.updateOne({ email: deactivatedEmail }, { isActive: false });

    await forgotPassword(email);
    await forgotPassword('forgot-email-unknown@example.com');
    await forgotPassword(deactivatedEmail);

    const sent = emailService.transport.getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);
    expect(sent[0].text).toContain('token=');
  });
});

describe('password reset flow', () => {
  beforeEach(() => emailService.transport.clearSentEmails());

  it('resets the password, then lets the new password sign in and the old one fail', async () => {
    const email = 'reset-happy@example.com';
    await registerCitizen(email);
    await forgotPassword(email);
    const token = extractResetToken();

    const res = await resetPassword(token, newValidPassword);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });

    const newLoginRes = await login(email, newValidPassword);
    expect(newLoginRes.status).toBe(200);

    const oldLoginRes = await login(email, validPassword);
    expect(oldLoginRes.status).toBe(401);
  });

  it('revokes every refresh token for the account on a successful reset', async () => {
    const email = 'reset-revokes-sessions@example.com';
    const { userId } = await registerCitizen(email);
    await login(email, validPassword);
    expect(await RefreshToken.countDocuments({ user: userId })).toBe(2);

    await forgotPassword(email);
    const token = extractResetToken();
    await resetPassword(token, newValidPassword);

    expect(await RefreshToken.countDocuments({ user: userId })).toBe(0);
  });

  it('refuses the same token on a second use with 400 RESET_TOKEN_INVALID', async () => {
    const email = 'reset-single-use@example.com';
    await registerCitizen(email);
    await forgotPassword(email);
    const token = extractResetToken();

    const firstRes = await resetPassword(token, newValidPassword);
    expect(firstRes.status).toBe(200);

    const secondRes = await resetPassword(token, 'AnotherPassword789!');
    expect(secondRes.status).toBe(400);
    expect(secondRes.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('refuses an expired token with 400 RESET_TOKEN_INVALID', async () => {
    const email = 'reset-expired@example.com';
    await registerCitizen(email);
    await forgotPassword(email);
    const token = extractResetToken();

    await PasswordResetToken.updateOne(
      { tokenHash: AuthService.hashResetToken(token) },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const res = await resetPassword(token, newValidPassword);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('refuses an unknown token with 400 RESET_TOKEN_INVALID', async () => {
    const res = await resetPassword('not-a-real-token', newValidPassword);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  it('refuses a newPassword below the registration minimum length with 400 and a field error', async () => {
    const email = 'reset-short-password@example.com';
    await registerCitizen(email);
    await forgotPassword(email);
    const token = extractResetToken();

    const res = await resetPassword(token, 'short');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'newPassword' })]),
    );
  });

  it('refuses a missing token with 400 VALIDATION_ERROR', async () => {
    const res = await resetPassword(undefined, newValidPassword);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'token' })]),
    );
  });
});
