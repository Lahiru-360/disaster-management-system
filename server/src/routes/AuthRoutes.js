import { authController } from '../controllers/AuthController.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { AuthValidator } from '../validators/AuthValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

export class AuthRoutes extends BaseRoutes {
  constructor() {
    super('/api/auth');
  }

  registerRoutes(router) {
    router.post(
      '/register',
      RequestValidator.body(AuthValidator.registerSchema),
      authController.register,
    );
    router.post('/login', RequestValidator.body(AuthValidator.loginSchema), authController.login);
    router.post(
      '/refresh',
      RequestValidator.body(AuthValidator.refreshSchema),
      authController.refresh,
    );
    router.post(
      '/logout',
      RequestValidator.body(AuthValidator.logoutSchema),
      authMiddleware.requireAuth,
      authController.logout,
    );
    router.get('/me', authMiddleware.requireAuth, authController.me);
    router.post(
      '/change-password',
      RequestValidator.body(AuthValidator.changePasswordSchema),
      authMiddleware.requireAuth,
      authController.changePassword,
    );
    router.post(
      '/forgot-password',
      RequestValidator.body(AuthValidator.forgotPasswordSchema),
      authController.forgotPassword,
    );
    router.post(
      '/reset-password',
      RequestValidator.body(AuthValidator.resetPasswordSchema),
      authController.resetPassword,
    );
    router.post('/deactivate', authMiddleware.requireAuth, authController.deactivate);
  }
}

export const authRoutes = new AuthRoutes();
