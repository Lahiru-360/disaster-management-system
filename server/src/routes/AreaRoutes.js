import { areaController } from '../controllers/AreaController.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { BaseRoutes } from './BaseRoutes.js';

// Districts and river basins are two resources but one feature, so they share
// this group, mounted at /api. Auth is declared per route, never with
// router.use(), so requests for other /api paths pass through untouched.
export class AreaRoutes extends BaseRoutes {
  constructor() {
    super('/api');
  }

  registerRoutes(router) {
    router.get('/districts', authMiddleware.requireAuth, areaController.listDistricts);
    router.get('/river-basins', authMiddleware.requireAuth, areaController.listRiverBasins);
  }
}

export const areaRoutes = new AreaRoutes();
