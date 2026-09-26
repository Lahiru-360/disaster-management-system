import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const errorHandler = (err, req, res, _next) => {
  const isApiError = err instanceof ApiError;

  if (!isApiError) {
    console.error(err);
  }

  const status = isApiError ? err.status : 500;
  const code = isApiError ? err.code : 'INTERNAL_ERROR';
  const message = isApiError ? err.message : 'Internal Server Error';
  const errors = isApiError ? err.errors : undefined;

  ApiResponse.error(res, status, code, message, errors);
};
