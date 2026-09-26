import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { storeFile } from '../services/storage.service.js';

export const createUpload = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_MISSING', 'No file was provided.');
  }

  const url = await storeFile(req.file.buffer, req.file.mimetype, req.body.folder);

  sendSuccess(res, { url }, 201);
});
