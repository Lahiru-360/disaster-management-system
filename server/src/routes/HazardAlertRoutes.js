import { hazardAlertController } from '../controllers/HazardAlertController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { HazardAlertValidator } from '../validators/HazardAlertValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC01 hazard alerts (contract §12). Every endpoint is for DMC officers;
// requireRole admits duty officers too, since a duty officer is a DMC officer.
export class HazardAlertRoutes extends BaseRoutes {
  constructor() {
    super('/api/hazard-alerts');
  }

  registerRoutes(router) {
    const officer = [authMiddleware.requireAuth, authMiddleware.requireRole(Role.DMC_OFFICER)];

    router.post(
      '/',
      ...officer,
      RequestValidator.body(HazardAlertValidator.startSchema),
      hazardAlertController.startDraft,
    );
    router.post(
      '/:id/preview',
      ...officer,
      RequestValidator.body(HazardAlertValidator.previewSchema),
      hazardAlertController.preview,
    );
    router.patch(
      '/:id/draft',
      ...officer,
      RequestValidator.body(HazardAlertValidator.draftMessageSchema),
      hazardAlertController.saveDraftMessage,
    );
    router.post(
      '/:id/broadcast',
      ...officer,
      RequestValidator.body(HazardAlertValidator.broadcastSchema),
      hazardAlertController.broadcast,
    );
    router.get('/:id/delivery-summary', ...officer, hazardAlertController.deliverySummary);
    router.get('/:id', ...officer, hazardAlertController.getById);
  }
}

export const hazardAlertRoutes = new HazardAlertRoutes();
