import { dispatchController } from '../controllers/DispatchController.js';
import { rescueTeamController } from '../controllers/RescueTeamController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { CoordinationValidator } from '../validators/CoordinationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC03 rescue teams (contract §13.5), for district officers and DMC officers.
// requireRole admits duty officers too, since a duty officer is a DMC
// officer. Which district each may read is the service's check (DistrictScope).
export class RescueTeamRoutes extends BaseRoutes {
  constructor() {
    super('/api/rescue-teams');
  }

  registerRoutes(router) {
    router.get(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER, Role.DMC_OFFICER),
      RequestValidator.query(CoordinationValidator.districtQuery),
      rescueTeamController.list,
    );

    // UC03 step 7: the nearest available teams, for the officer dispatching.
    router.get(
      '/available',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      RequestValidator.query(CoordinationValidator.availableQuery),
      dispatchController.findAvailableTeams,
    );

    // UC03 E4: a team that missed its deadline is put back in the list by hand.
    router.post(
      '/:id/availability',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      rescueTeamController.markAvailable,
    );
  }
}

export const rescueTeamRoutes = new RescueTeamRoutes();
