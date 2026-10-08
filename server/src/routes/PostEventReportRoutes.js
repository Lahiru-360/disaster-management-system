import { postEventReportController } from '../controllers/PostEventReportController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { PostEventReportValidator } from '../validators/PostEventReportValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC04 post-event reports (contract §14). Every endpoint is for DMC officers;
// requireRole admits duty officers too, since a duty officer is a DMC officer.
export class PostEventReportRoutes extends BaseRoutes {
  constructor() {
    super('/api/post-event-reports');
  }

  registerRoutes(router) {
    const officer = [authMiddleware.requireAuth, authMiddleware.requireRole(Role.DMC_OFFICER)];

    router.get(
      '/',
      ...officer,
      RequestValidator.query(PostEventReportValidator.listQuery),
      postEventReportController.list,
    );
    router.post(
      '/',
      ...officer,
      RequestValidator.body(PostEventReportValidator.generateSchema),
      postEventReportController.generate,
    );
    router.get('/:id', ...officer, postEventReportController.getById);
    router.post(
      '/:id/exports',
      ...officer,
      RequestValidator.body(PostEventReportValidator.exportSchema),
      postEventReportController.createExport,
    );
    router.post(
      '/:id/shares',
      ...officer,
      RequestValidator.body(PostEventReportValidator.shareSchema),
      postEventReportController.createShare,
    );
    router.get('/:id/shares', ...officer, postEventReportController.listShares);
  }
}

export const postEventReportRoutes = new PostEventReportRoutes();
