import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/response.js';

export const errorHandler = (err, req, res, _next) => {
  const isApiError = err instanceof ApiError;

  if (!isApiError) {
    console.error(err);
  }

  const status = isApiError ? err.status : 500;
  const code = isApiError ? err.code : 'INTERNAL_ERROR';
  const message = isApiError ? err.message : 'Internal Server Error';
  const errors = isApiError ? err.errors : undefined;

  sendError(res, status, code, message, errors);
};
