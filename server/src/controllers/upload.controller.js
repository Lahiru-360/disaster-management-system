import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { storageService } from '../services/StorageService.js';

export const createUpload = AsyncHandler.wrap(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'FILE_MISSING', 'No file was provided.');
  }

  const url = await storageService.storeFile(req.file.buffer, req.file.mimetype, req.body.folder);

  ApiResponse.success(res, { url }, 201);
});
