import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { authService } from '../services/AuthService.js';

export const register = AsyncHandler.wrap(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);

  ApiResponse.success(res, { user, accessToken, refreshToken }, 201);
});

export const login = AsyncHandler.wrap(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);

  ApiResponse.success(res, { user, accessToken, refreshToken }, 200);
});

export const refresh = AsyncHandler.wrap(async (req, res) => {
  const { accessToken, refreshToken } = await authService.refreshTokens(req.body.refreshToken);

  ApiResponse.success(res, { accessToken, refreshToken }, 200);
});

export const logout = AsyncHandler.wrap(async (req, res) => {
  await authService.logout(req.body.refreshToken);

  ApiResponse.success(res, null, 200);
});

export const me = AsyncHandler.wrap(async (req, res) => {
  ApiResponse.success(res, { user: req.user }, 200);
});

export const changePassword = AsyncHandler.wrap(async (req, res) => {
  const { accessToken, refreshToken } = await authService.changePassword(req.user, req.body);

  ApiResponse.success(res, { accessToken, refreshToken }, 200);
});

export const forgotPassword = AsyncHandler.wrap(async (req, res) => {
  await authService.requestPasswordReset(req.body);

  ApiResponse.success(
    res,
    { message: 'If that email is registered, a password reset link has been sent.' },
    200,
  );
});

export const resetUserPassword = AsyncHandler.wrap(async (req, res) => {
  await authService.resetPassword(req.body);

  ApiResponse.success(res, null, 200);
});

export const deactivate = AsyncHandler.wrap(async (req, res) => {
  await authService.deactivateAccount(req.user);

  ApiResponse.success(res, null, 200);
});
