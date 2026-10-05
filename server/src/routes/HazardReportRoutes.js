import { hazardReportController } from '../controllers/HazardReportController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { HazardReportValidator } from '../validators/HazardReportValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC02 hazard reports (contract §9). Submitting is for citizens; requireRole
// admits community volunteers too, since a volunteer is a citizen.
export class HazardReportRoutes extends BaseRoutes {
  constructor() {
    super('/api/hazard-reports');
  }

  registerRoutes(router) {
    router.post(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.CITIZEN),
      RequestValidator.body(HazardReportValidator.submitSchema),
      hazardReportController.submit,
    );
  }
}

export const hazardReportRoutes = new HazardReportRoutes();
