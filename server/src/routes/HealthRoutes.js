import { healthController } from '../controllers/HealthController.js';
import { BaseRoutes } from './BaseRoutes.js';

export class HealthRoutes extends BaseRoutes {
  constructor() {
    super('/api/health');
  }

  registerRoutes(router) {
    router.get('/', healthController.check);
  }
}

export const healthRoutes = new HealthRoutes();
