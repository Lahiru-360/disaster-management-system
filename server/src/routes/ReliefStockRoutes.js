import { supplyController } from '../controllers/SupplyController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { CoordinationValidator } from '../validators/CoordinationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC03 relief stock (contract §13.11.1), for district officers and DMC
// officers (duty officers too). Which district each may read is the
// service's check (DistrictScope).
export class ReliefStockRoutes extends BaseRoutes {
  constructor() {
    super('/api/relief-stock');
  }

  registerRoutes(router) {
    router.get(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER, Role.DMC_OFFICER),
      RequestValidator.query(CoordinationValidator.stockQuery),
      supplyController.listStock,
    );
  }
}

export const reliefStockRoutes = new ReliefStockRoutes();
