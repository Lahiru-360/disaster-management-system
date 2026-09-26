import { Router } from 'express';
import { healthController } from '../controllers/HealthController.js';

const router = Router();

router.get('/', healthController.check);

export default router;
