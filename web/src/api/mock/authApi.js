// Mock implementation of the auth endpoints in docs/api-contract.md, trimmed
// from app/src/api/mock/authApi.js to the calls ../authApi.js makes.
// Resolves with the same shape the real client will hand back (the envelope's
// `data`), and rejects with an axios-shaped error (`error.response.status` /
// `error.response.data`) so swapping in the real client is a change
// of import target, not a change to any calling code's error handling.
//
// Sessions live in this module's memory, so reloading the page forgets them
// and signs you out - log in again from the demo picker. Each browser tab
// also gets its own copy of this mock.

import { DEMO_PASSWORD, DEMO_USERS } from '../../constants/demoUsers';

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

const ACCESS_TOKEN_TTL_MS = 20 * 1000;
const REFRESH_TOKEN_TTL_MS = 5 * 60 * 1000;

// Every demo account, field roles included, so signing in as a field role here
// reaches the same wrong-platform screen it would against the real server.
const users = DEMO_USERS.map(({ name, email, role }, index) => ({
  id: `64f1a2b3c4d5e6f7a8b9c0d${index + 1}`,
  name,
  email,
  password: DEMO_PASSWORD,
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
}));

const accessTokens = new Map();
const refreshTokens = new Map();

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomToken() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
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
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
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

async function login({ email, password }) {
  await delay();

  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (!user || user.password !== password) {
    throw apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
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

export default {
  login,
  refresh,
  logout,
  getCurrentUser,
};
