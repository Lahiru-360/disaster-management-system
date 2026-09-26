import Joi from 'joi';

// Closed list on purpose (parent story AC11): a caller names a fixed purpose,
// never an arbitrary path, so it can never write anywhere else in the bucket.
// `trials` and `resumes` both inherit the same 5 MB cap and PNG/JPG/PDF
// allow-list as `avatars` — see the shared schema below.
export const UPLOAD_FOLDER_VALUES = ['avatars', 'trials', 'resumes'];

export const uploadSchema = Joi.object({
  folder: Joi.string()
    .valid(...UPLOAD_FOLDER_VALUES)
    .required(),
});
