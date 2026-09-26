import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  changeUserPassword,
  requestPasswordReset,
  resetPassword,
  deactivateOwnAccount,
} from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await registerUser(req.body);

  sendSuccess(res, { user, accessToken, refreshToken }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);

  sendSuccess(res, { user, accessToken, refreshToken }, 200);
});

export const refresh = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await refreshTokens(req.body.refreshToken);

  sendSuccess(res, { accessToken, refreshToken }, 200);
});

export const logout = asyncHandler(async (req, res) => {
  await logoutUser(req.body.refreshToken);

  sendSuccess(res, null, 200);
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { user: req.user }, 200);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await changeUserPassword(req.user, req.body);

  sendSuccess(res, { accessToken, refreshToken }, 200);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await requestPasswordReset(req.body);

  sendSuccess(
    res,
    { message: 'If that email is registered, a password reset link has been sent.' },
    200,
  );
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  await resetPassword(req.body);

  sendSuccess(res, null, 200);
});

export const deactivate = asyncHandler(async (req, res) => {
  await deactivateOwnAccount(req.user);

  sendSuccess(res, null, 200);
});
