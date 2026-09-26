import { Router } from 'express';
import { authMiddleware } from '../middleware/AuthMiddleware.js';
import { fileUploadMiddleware } from '../middleware/FileUploadMiddleware.js';
import { RequestValidator } from '../middleware/RequestValidator.js';
import { UploadValidator } from '../validators/UploadValidator.js';
import { uploadController } from '../controllers/UploadController.js';

const router = Router();

// multer runs before validate here, not after: req.body.folder only exists
// once multer has parsed the multipart body, so validate has nothing to check
// until then.
router.post(
  '/',
  authMiddleware.requireAuth,
  fileUploadMiddleware.single('file'),
  RequestValidator.body(UploadValidator.uploadSchema),
  uploadController.create,
);

export default router;
