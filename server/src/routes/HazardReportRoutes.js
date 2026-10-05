import { hazardReportController } from '../controllers/HazardReportController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { HazardReportValidator } from '../validators/HazardReportValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC02 hazard reports (contract §9). Submitting and "my reports" are for
// citizens - requireRole admits community volunteers too, since a volunteer is
// a citizen. Reviewing is for duty officers only (the verification privilege);
// which district's reports they see is the service's check.
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

    // Before /:id, so "mine" is never taken for a report id.
    router.get(
      '/mine',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.CITIZEN),
      hazardReportController.listMine,
    );

    router.get(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DUTY_OFFICER),
      RequestValidator.query(HazardReportValidator.queueQuery),
      hazardReportController.listPending,
    );

    router.get(
      '/:id',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DUTY_OFFICER),
      hazardReportController.getDetail,
    );

    router.post(
      '/:id/confirm',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DUTY_OFFICER),
      hazardReportController.confirm,
    );
  }
}

export const hazardReportRoutes = new HazardReportRoutes();
