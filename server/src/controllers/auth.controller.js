import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
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

export const register = AsyncHandler.wrap(async (req, res) => {
  const { user, accessToken, refreshToken } = await registerUser(req.body);

  ApiResponse.success(res, { user, accessToken, refreshToken }, 201);
});

export const login = AsyncHandler.wrap(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);

  ApiResponse.success(res, { user, accessToken, refreshToken }, 200);
});

export const refresh = AsyncHandler.wrap(async (req, res) => {
  const { accessToken, refreshToken } = await refreshTokens(req.body.refreshToken);

  ApiResponse.success(res, { accessToken, refreshToken }, 200);
});

export const logout = AsyncHandler.wrap(async (req, res) => {
  await logoutUser(req.body.refreshToken);

  ApiResponse.success(res, null, 200);
});

export const me = AsyncHandler.wrap(async (req, res) => {
  ApiResponse.success(res, { user: req.user }, 200);
});

export const changePassword = AsyncHandler.wrap(async (req, res) => {
  const { accessToken, refreshToken } = await changeUserPassword(req.user, req.body);

  ApiResponse.success(res, { accessToken, refreshToken }, 200);
});

export const forgotPassword = AsyncHandler.wrap(async (req, res) => {
  await requestPasswordReset(req.body);

  ApiResponse.success(
    res,
    { message: 'If that email is registered, a password reset link has been sent.' },
    200,
  );
});

export const resetUserPassword = AsyncHandler.wrap(async (req, res) => {
  await resetPassword(req.body);

  ApiResponse.success(res, null, 200);
});

export const deactivate = AsyncHandler.wrap(async (req, res) => {
  await deactivateOwnAccount(req.user);

  ApiResponse.success(res, null, 200);
});
