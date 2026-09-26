import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// The last two handlers in the chain: a 404 for any request no route matched,
// and the error handler that turns anything thrown or passed to next() into
// the standard error envelope.
export class ErrorHandler {
  static notFound(req, res) {
    ApiResponse.error(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
  }

  // Express only treats a handler as error-handling middleware when it
  // declares four parameters, so the unused `_next` has to stay.
  static handle(err, req, res, _next) {
    const isApiError = err instanceof ApiError;

    if (!isApiError) {
      console.error(err);
    }

    const status = isApiError ? err.status : 500;
    const code = isApiError ? err.code : 'INTERNAL_ERROR';
    const message = isApiError ? err.message : 'Internal Server Error';
    const errors = isApiError ? err.errors : undefined;

    ApiResponse.error(res, status, code, message, errors);
  }
}
