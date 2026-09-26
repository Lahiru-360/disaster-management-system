import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { uploadFile } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadSchema } from '../validators/upload.validator.js';
import { createUpload } from '../controllers/upload.controller.js';

const router = Router();

// multer runs before validate here, not after: req.body.folder only exists
// once multer has parsed the multipart body, so validate has nothing to check
// until then.
router.post('/', requireAuth, uploadFile('file'), validate(uploadSchema), createUpload);

export default router;
