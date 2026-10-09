import { placeController } from '../controllers/PlaceController.js';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { PlaceValidator } from '../validators/PlaceValidator.js';
import { BaseRoutes } from './BaseRoutes.js';

// Place search for any signed-in role, like the areas endpoints (§9.8).
export class PlaceRoutes extends BaseRoutes {
  constructor() {
    super('/api/places');
  }

  registerRoutes(router) {
    router.get(
      '/',
      authMiddleware.requireAuth,
      RequestValidator.query(PlaceValidator.searchQuery),
      placeController.search,
    );
  }
}

export const placeRoutes = new PlaceRoutes();
