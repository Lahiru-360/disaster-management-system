import { ApiResponse } from '../utils/ApiResponse.js';

export const notFound = (req, res) => {
  ApiResponse.error(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
};
