// Mock implementation of the auth endpoints in docs/api-contract.md.
// Resolves with the same shape the real client will hand back (the envelope's
// `data`), and rejects with an axios-shaped error (`error.response.status` /
// `error.response.data`) so swapping in the real client is a change
// of import target, not a change to any calling code's error handling.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

const ACCESS_TOKEN_TTL_MS = 20 * 1000;
const REFRESH_TOKEN_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['seeker', 'business'];

const users = [
  {
    id: '64f1a2b3c4d5e6f7a8b9c0d1',
    email: 'seeker@example.test',
    password: 'Password123!',
    role: 'seeker',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '64f1a2b3c4d5e6f7a8b9c0d2',
    email: 'business@example.test',
    password: 'Password123!',
    role: 'business',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '64f1a2b3c4d5e6f7a8b9c0d3',
    email: 'admin@example.test',
    password: 'Password123!',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const accessTokens = new Map();
const refreshTokens = new Map();
const passwordResetTokens = new Map();

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomToken() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function randomObjectId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function apiError(status, code, message, errors) {
  const error = new Error(message);
  error.response = {
    status,
    data: {
      success: false,
      error: errors ? { code, message, errors } : { code, message },
    },
  };
  return error;
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function validateRegisterInput({ email, password, role }) {
  const errors = [];
  if (!email || !EMAIL_RE.test(email)) {
    errors.push({ field: 'email', message: 'must be a valid email address' });
  }
  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'must be at least 8 characters' });
  }
  if (!role || !ROLES.includes(role)) {
    errors.push({ field: 'role', message: "must be 'seeker' or 'business'" });
  }
  return errors;
}

function issueSession(user) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  accessTokens.set(accessToken, { userId: user.id, expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS });
  refreshTokens.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });
  return { user: toPublicUser(user), accessToken, refreshToken };
}

function requireValidAccessToken(accessToken) {
  if (!accessToken || !accessTokens.has(accessToken)) {
    throw apiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
  }
  const record = accessTokens.get(accessToken);
  if (record.expiresAt < Date.now()) {
    accessTokens.delete(accessToken);
    throw apiError(401, 'TOKEN_EXPIRED', 'Access token has expired. Please refresh your session.');
  }
  return record.userId;
}

async function register({ email, password, role }) {
  await delay();

  const validationErrors = validateRegisterInput({ email, password, role });
  if (validationErrors.length > 0) {
    throw apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', validationErrors);
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) {
    throw apiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
  }

  const user = {
    id: randomObjectId(),
    email: normalizedEmail,
    password,
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);

  return issueSession(user);
}

async function login({ email, password }) {
  await delay();

  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (!user || user.password !== password) {
    throw apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  if (user.active === false) {
    throw apiError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated.');
  }

  return issueSession(user);
}

async function refresh({ refreshToken }) {
  await delay();

  const record = refreshTokens.get(refreshToken);
  if (!record) {
    throw apiError(401, 'TOKEN_INVALID', 'Refresh token is invalid.');
  }
  refreshTokens.delete(refreshToken);

  if (record.expiresAt < Date.now()) {
    throw apiError(401, 'TOKEN_EXPIRED', 'Refresh token has expired. Please log in again.');
  }

  const user = users.find((candidate) => candidate.id === record.userId);
  if (!user) {
    throw apiError(401, 'TOKEN_INVALID', 'Refresh token is invalid.');
  }

  const accessToken = randomToken();
  const newRefreshToken = randomToken();
  accessTokens.set(accessToken, { userId: user.id, expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS });
  refreshTokens.set(newRefreshToken, {
    userId: user.id,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout({ accessToken, refreshToken }) {
  await delay();

  requireValidAccessToken(accessToken);

  accessTokens.delete(accessToken);
  if (refreshToken) {
    refreshTokens.delete(refreshToken);
  }

  return null;
}

async function getCurrentUser({ accessToken }) {
  await delay();

  const userId = requireValidAccessToken(accessToken);
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw apiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
  }

  return { user: toPublicUser(user) };
}

// Deliberately stubbed, but only meaningfully testable for the single
// running session. Every Map here is per-process, in-memory state -
// a second "device" in dev is a second Expo process with its own Maps, so
// the cross-device revocation this endpoint exists for can never be
// observed against the mock, however this function is written. It's still
// worth stubbing so the default (mock) dev config exercises the in-progress
// state, field-level error, and success paths instead of throwing on
// `authApi.changePassword is not a function`. Verifying the real endpoint's
// revoke-on-change-password behaviour needs EXPO_PUBLIC_USE_MOCK=false
// against the real server (see docs/api-contract.md §5.6).
async function changePassword({ accessToken, currentPassword, newPassword }) {
  await delay();

  const userId = requireValidAccessToken(accessToken);
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw apiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
  }

  if (user.password !== currentPassword) {
    throw apiError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
  }

  if (!newPassword || newPassword.length < 8) {
    throw apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'newPassword', message: 'must be at least 8 characters' },
    ]);
  }

  if (newPassword === currentPassword) {
    throw apiError(
      400,
      'PASSWORD_UNCHANGED',
      'New password must be different from your current password.',
    );
  }

  user.password = newPassword;

  // Mirrors the real endpoint: revoke every token this user holds,
  // then issue a fresh pair - within this one process's Maps only.
  for (const [token, record] of refreshTokens.entries()) {
    if (record.userId === user.id) refreshTokens.delete(token);
  }
  for (const [token, record] of accessTokens.entries()) {
    if (record.userId === user.id) accessTokens.delete(token);
  }

  const session = issueSession(user);
  return { accessToken: session.accessToken, refreshToken: session.refreshToken };
}

// Mirrors the real endpoint - deactivates the caller's own account and
// revokes every token they hold, the same revoke-everything sweep
// changePassword above does. login() then refuses a re-attempt the
// same way the real server does (ACCOUNT_DEACTIVATED), so the mock adapter
// exercises the same "can't sign back in" behaviour manual testing needs.
async function deactivateAccount({ accessToken }) {
  await delay();

  const userId = requireValidAccessToken(accessToken);
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) {
    throw apiError(401, 'UNAUTHENTICATED', 'You must be logged in to do this.');
  }

  user.active = false;

  for (const [token, record] of refreshTokens.entries()) {
    if (record.userId === user.id) refreshTokens.delete(token);
  }
  for (const [token, record] of accessTokens.entries()) {
    if (record.userId === user.id) accessTokens.delete(token);
  }

  return null;
}

// Mirrors the real endpoint's anti-enumeration rule (docs/api-contract.md
// §5.9) - always the same success body, whether the address matches an active
// account, a deactivated one, or no account at all. A deactivated account gets
// no token, same as it gets no email for real. There is no mock email inbox
// and no deep link yet (both deferred to a later task), so the token is
// logged to the console as the dev-only stand-in for "check your email",
// for pasting into navigation.navigate('ResetPassword', { token, email })
// while testing.
async function requestPasswordReset({ email }) {
  await delay();

  if (!email || !EMAIL_RE.test(email)) {
    throw apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'email', message: 'must be a valid email' },
    ]);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (user && user.active !== false) {
    // Requesting again invalidates the previous link (docs/api-contract.md
    // §5.9) - only the most recent token for this user is ever valid.
    for (const [token, record] of passwordResetTokens.entries()) {
      if (record.userId === user.id) passwordResetTokens.delete(token);
    }

    const token = randomToken();
    passwordResetTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
      used: false,
    });
    console.log(`[mock authApi] password reset token for ${normalizedEmail}: ${token}`);
  }

  return { message: 'If that email is registered, a password reset link has been sent.' };
}

// An expired, already-used, unknown or malformed token all collapse
// to the same RESET_TOKEN_INVALID refusal (docs/api-contract.md §5.10) -
// distinguishing them would tell an attacker holding a stale token which
// state it's in. Revokes every session, not every other one, since there is
// no acting session to preserve here.
async function resetPassword({ token, newPassword }) {
  await delay();

  const record = token ? passwordResetTokens.get(token) : undefined;
  if (!record || record.used || record.expiresAt < Date.now()) {
    throw apiError(
      400,
      'RESET_TOKEN_INVALID',
      'This reset link is invalid or has expired. Request a new one.',
    );
  }

  if (!newPassword || newPassword.length < 8) {
    throw apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'newPassword', message: 'must be at least 8 characters' },
    ]);
  }

  const user = users.find((candidate) => candidate.id === record.userId);
  if (!user) {
    throw apiError(
      400,
      'RESET_TOKEN_INVALID',
      'This reset link is invalid or has expired. Request a new one.',
    );
  }

  record.used = true;
  user.password = newPassword;

  for (const [refreshToken, refreshRecord] of refreshTokens.entries()) {
    if (refreshRecord.userId === user.id) refreshTokens.delete(refreshToken);
  }
  for (const [accessToken, accessRecord] of accessTokens.entries()) {
    if (accessRecord.userId === user.id) accessTokens.delete(accessToken);
  }

  return null;
}

export default {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  changePassword,
  deactivateAccount,
  requestPasswordReset,
  resetPassword,
};
