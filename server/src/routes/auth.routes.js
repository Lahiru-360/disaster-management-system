import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  me,
  changePassword,
  forgotPassword,
  resetUserPassword,
  deactivate,
} from '../controllers/auth.controller.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { AuthValidator } from '../validators/AuthValidator.js';

const router = Router();

router.post('/register', RequestValidator.body(AuthValidator.registerSchema), register);
router.post('/login', RequestValidator.body(AuthValidator.loginSchema), login);
router.post('/refresh', RequestValidator.body(AuthValidator.refreshSchema), refresh);
router.post(
  '/logout',
  RequestValidator.body(AuthValidator.logoutSchema),
  authMiddleware.requireAuth,
  logout,
);
router.get('/me', authMiddleware.requireAuth, me);
router.post(
  '/change-password',
  RequestValidator.body(AuthValidator.changePasswordSchema),
  authMiddleware.requireAuth,
  changePassword,
);
router.post(
  '/forgot-password',
  RequestValidator.body(AuthValidator.forgotPasswordSchema),
  forgotPassword,
);
router.post(
  '/reset-password',
  RequestValidator.body(AuthValidator.resetPasswordSchema),
  resetUserPassword,
);
router.post('/deactivate', authMiddleware.requireAuth, deactivate);

export default router;
