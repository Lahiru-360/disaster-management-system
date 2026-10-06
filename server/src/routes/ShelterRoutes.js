import { shelterController } from '../controllers/ShelterController.js';
import { Role } from '../enums/Role.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { CoordinationValidator } from '../validators/CoordinationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// UC03 shelters (contract §13.4), for district officers and DMC officers.
// requireRole admits duty officers too, since a duty officer is a DMC
// officer. Which district each may read is the service's check (DistrictScope).
export class ShelterRoutes extends BaseRoutes {
  constructor() {
    super('/api/shelters');
  }

  registerRoutes(router) {
    router.get(
      '/',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER, Role.DMC_OFFICER),
      RequestValidator.query(CoordinationValidator.districtQuery),
      shelterController.list,
    );

    // UC03 steps 3-5: district officers only, in their own district.
    router.patch(
      '/:id/occupancy',
      authMiddleware.requireAuth,
      authMiddleware.requireRole(Role.DISTRICT_OFFICER),
      shelterController.updateOccupancy,
    );
  }
}

export const shelterRoutes = new ShelterRoutes();
