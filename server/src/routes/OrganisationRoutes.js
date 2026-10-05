import { organisationController } from '../controllers/OrganisationController.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { OrganisationValidator } from '../validators/OrganisationValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

export class OrganisationRoutes extends BaseRoutes {
  constructor() {
    super('/api/organisations');
  }

  registerRoutes(router) {
    router.get(
      '/',
      authMiddleware.requireAuth,
      RequestValidator.query(OrganisationValidator.listQuery),
      organisationController.list,
    );
  }
}

export const organisationRoutes = new OrganisationRoutes();
