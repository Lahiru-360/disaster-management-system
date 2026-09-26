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
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', RequestValidator.body(registerSchema), register);
router.post('/login', RequestValidator.body(loginSchema), login);
router.post('/refresh', RequestValidator.body(refreshSchema), refresh);
router.post('/logout', RequestValidator.body(logoutSchema), authMiddleware.requireAuth, logout);
router.get('/me', authMiddleware.requireAuth, me);
router.post(
  '/change-password',
  RequestValidator.body(changePasswordSchema),
  authMiddleware.requireAuth,
  changePassword,
);
router.post('/forgot-password', RequestValidator.body(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', RequestValidator.body(resetPasswordSchema), resetUserPassword);
router.post('/deactivate', authMiddleware.requireAuth, deactivate);

export default router;
