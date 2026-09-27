// Real auth client. Same function signatures as ./mock/authApi.js so
// index.js can swap between them with no other code change. Errors
// propagate as-is: axios rejections already carry `error.response.data.error`
// in the same shape the mock fakes.
//
// Only the calls the portal uses so far. The rest of the auth endpoints
// (change password, password reset, deactivate) are in app/src/api/authApi.js
// to copy from when a screen needs them. There's no register: officer
// accounts are created by the seed script, never by public sign-up.

import client from './client';

async function login({ email, password }) {
  const response = await client.post('/auth/login', { email, password });
  return response.data.data;
}

async function refresh({ refreshToken }) {
  const response = await client.post('/auth/refresh', { refreshToken });
  return response.data.data;
}

async function logout({ refreshToken }) {
  const response = await client.post('/auth/logout', { refreshToken });
  return response.data.data;
}

async function getCurrentUser() {
  const response = await client.get('/auth/me');
  return response.data.data;
}

export default {
  login,
  refresh,
  logout,
  getCurrentUser,
};
