import { storageService as defaultStorageService } from '../services/StorageService.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { BaseController } from './BaseController.js';

// HTTP layer for /api/uploads.
export class UploadController extends BaseController {
  #storageService;

  constructor(storageService = defaultStorageService) {
    super();
    this.#storageService = storageService;
  }

  async create(req, res) {
    if (!req.file) {
      throw new ApiError(400, 'FILE_MISSING', 'No file was provided.');
    }

    const url = await this.#storageService.storeFile(
      req.file.buffer,
      req.file.mimetype,
      req.body.folder,
    );

    ApiResponse.success(res, { url }, 201);
  }
}

export const uploadController = new UploadController();
