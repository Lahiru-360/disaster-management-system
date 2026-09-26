import multer from 'multer';
import path from 'node:path';
import { ApiError } from '../utils/ApiError.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/pdf': ['.pdf'],
};

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ALLOWED_TYPES[file.mimetype];

  if (!allowedExtensions) {
    cb(new ApiError(400, 'UNSUPPORTED_FILE_TYPE', 'Only PNG, JPG and PDF files are allowed.'));
    return;
  }

  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    cb(new ApiError(400, 'FILE_TYPE_MISMATCH', 'File extension does not match its reported type.'));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

export const uploadFile = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(400, 'FILE_TOO_LARGE', 'File exceeds the 5MB limit.'));
      return;
    }

    next(err);
  });
};
