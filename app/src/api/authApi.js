// Real auth client. Same function signatures as ./mock/authApi.js so
// index.js can swap between them with no other code change. Errors
// propagate as-is: axios rejections already carry `error.response.data.error`
// in the same shape the mock fakes.
//
// changePassword takes an `accessToken` field too (unused here - the
// request interceptor in ./client.js attaches it) purely so the same call
// site works against ./mock/authApi.js, which has no interceptor to do that
// for it.

import client from './client';

async function register({ email, password, role }) {
  const response = await client.post('/auth/register', { email, password, role });
  return response.data.data;
}

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

async function changePassword({ currentPassword, newPassword }) {
  const response = await client.post('/auth/change-password', { currentPassword, newPassword });
  return response.data.data;
}

async function deactivateAccount() {
  const response = await client.post('/auth/deactivate');
  return response.data.data;
}

async function requestPasswordReset({ email }) {
  const response = await client.post('/auth/forgot-password', { email });
  return response.data.data;
}

async function resetPassword({ token, newPassword }) {
  const response = await client.post('/auth/reset-password', { token, newPassword });
  return response.data.data;
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
