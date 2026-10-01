import Joi from 'joi';

// Request-body schema for POST /api/uploads.
export class UploadValidator {
  // Closed list on purpose: a caller names a fixed purpose, never an
  // arbitrary path, so it can never write anywhere else in the bucket. Every
  // folder shares the same 5 MB cap and PNG/JPG/PDF allow-list, enforced by
  // FileUploadMiddleware. Add a folder here when a feature needs one.
  static FOLDER_VALUES = ['avatars', 'hazard-reports'];

  static uploadSchema = Joi.object({
    folder: Joi.string()
      .valid(...UploadValidator.FOLDER_VALUES)
      .required(),
  });
}
