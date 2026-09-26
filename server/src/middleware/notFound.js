import { sendError } from '../utils/response.js';

export const notFound = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
};
