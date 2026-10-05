import { hazardEventController } from '../controllers/HazardEventController.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { HazardEventValidator } from '../validators/HazardEventValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

export class HazardEventRoutes extends BaseRoutes {
  constructor() {
    super('/api/hazard-events');
  }

  registerRoutes(router) {
    router.get(
      '/',
      authMiddleware.requireAuth,
      RequestValidator.query(HazardEventValidator.listQuery),
      hazardEventController.list,
    );
  }
}

export const hazardEventRoutes = new HazardEventRoutes();
