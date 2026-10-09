import { supplyController } from '../controllers/SupplyController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { CoordinationValidator } from '../validators/CoordinationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC03 supply distributions (contract §13.11.2): district officers log what
// went to a shelter in their own district.
export class SupplyDistributionRoutes extends BaseRoutes {
  constructor() {
    super('/api/supply-distributions');
  }

  registerRoutes(router) {
    router.post(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      RequestValidator.body(CoordinationValidator.distributionBody),
      supplyController.logDistribution,
    );
  }
}

export const supplyDistributionRoutes = new SupplyDistributionRoutes();
