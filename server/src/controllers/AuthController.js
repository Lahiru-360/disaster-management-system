import { authService as defaultAuthService } from '../services/AuthService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/auth: unpacks the request, calls AuthService, and
// shapes the response.
export class AuthController extends BaseController {
  #authService;

  constructor(authService = defaultAuthService) {
    super();
    this.#authService = authService;
  }

  async register(req, res) {
    const { user, accessToken, refreshToken } = await this.#authService.register(req.body);

    ApiResponse.success(res, { user, accessToken, refreshToken }, 201);
  }

  async login(req, res) {
    const { user, accessToken, refreshToken } = await this.#authService.login(req.body);

    ApiResponse.success(res, { user, accessToken, refreshToken }, 200);
  }

  async refresh(req, res) {
    const { accessToken, refreshToken } = await this.#authService.refreshTokens(
      req.body.refreshToken,
    );

    ApiResponse.success(res, { accessToken, refreshToken }, 200);
  }

  async logout(req, res) {
    await this.#authService.logout(req.body.refreshToken);

    ApiResponse.success(res, null, 200);
  }

  async me(req, res) {
    ApiResponse.success(res, { user: req.user }, 200);
  }

  async changePassword(req, res) {
    const { accessToken, refreshToken } = await this.#authService.changePassword(
      req.user,
      req.body,
    );

    ApiResponse.success(res, { accessToken, refreshToken }, 200);
  }

  async forgotPassword(req, res) {
    await this.#authService.requestPasswordReset(req.body);

    ApiResponse.success(
      res,
      { message: 'If that email is registered, a password reset link has been sent.' },
      200,
    );
  }

  async resetPassword(req, res) {
    await this.#authService.resetPassword(req.body);

    ApiResponse.success(res, null, 200);
  }

  async deactivate(req, res) {
    await this.#authService.deactivateAccount(req.user);

    ApiResponse.success(res, null, 200);
  }
}

export const authController = new AuthController();
