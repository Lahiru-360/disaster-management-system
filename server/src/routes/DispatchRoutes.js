import { dispatchController } from '../controllers/DispatchController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { CoordinationValidator } from '../validators/CoordinationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC03 dispatches (contract §13.7). Two audiences: the district officer who
// dispatches a team, and the lead of that team answering from the field app.
// Which district and which team each may act on is the service's check.
export class DispatchRoutes extends BaseRoutes {
  constructor() {
    super('/api/dispatches');
  }

  registerRoutes(router) {
    // Officer: dispatch a team (steps 8-9).
    router.post(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      RequestValidator.body(CoordinationValidator.dispatchBody),
      dispatchController.dispatch,
    );

    // Officer: no team is free, so queue the incident and ask the DMC (E3).
    router.post(
      '/unassigned',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      RequestValidator.body(CoordinationValidator.unassignedBody),
      dispatchController.queueUnassigned,
    );

    // Officer: a team is free, so a queued incident gets it (E3).
    router.post(
      '/:id/assign',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      RequestValidator.body(CoordinationValidator.assignBody),
      dispatchController.assign,
    );

    // Console: the district's dispatches, e.g. the declined ones to reassign.
    // requireRole admits duty officers too, since a duty officer is a DMC
    // officer; which district each may read is the service's check.
    router.get(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER, Role.DMC_OFFICER),
      RequestValidator.query(CoordinationValidator.dispatchListQuery),
      dispatchController.list,
    );

    // Field app: the lead's assignments, before /:id so "mine" is never an id.
    router.get(
      '/mine',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.RESCUE_TEAM_LEAD),
      dispatchController.listMine,
    );

    // Field app: the lead turns the assignment down, with a reason (A3).
    router.post(
      '/:id/decline',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.RESCUE_TEAM_LEAD),
      RequestValidator.body(CoordinationValidator.declineBody),
      dispatchController.decline,
    );

    // Field app: the lead answers the assignment (steps 10-11).
    for (const [path, action] of [
      ['acknowledge', 'acknowledge'],
      ['on-site', 'markOnSite'],
      ['complete', 'complete'],
    ]) {
      router.post(
        `/:id/${path}`,
        authMiddleware.requireAuth,
        authMiddleware.requireRole(Role.RESCUE_TEAM_LEAD),
        dispatchController[action],
      );
    }
  }
}

export const dispatchRoutes = new DispatchRoutes();
