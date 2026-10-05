import { notificationController } from '../controllers/NotificationController.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { NotificationValidator } from '../validators/NotificationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// The in-app inbox. Every role has one, so there is no role check: a user only
// ever reaches their own items.
export class NotificationRoutes extends BaseRoutes {
  constructor() {
    super('/api/notifications');
  }

  registerRoutes(router) {
    router.get(
      '/me',
      authMiddleware.requireAuth,
      RequestValidator.query(NotificationValidator.listSchema),
      notificationController.listMine,
    );
    router.patch('/:id/read', authMiddleware.requireAuth, notificationController.markRead);
  }
}

export const notificationRoutes = new NotificationRoutes();
