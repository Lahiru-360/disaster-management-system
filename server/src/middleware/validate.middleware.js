import { ApiError } from '../utils/ApiError.js';

const formatValidationErrors = (error) =>
  error.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message.replace(/"/g, ''),
  }));

export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return next(
      new ApiError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed.',
        formatValidationErrors(error),
      ),
    );
  }

  req.body = value;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return next(
      new ApiError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed.',
        formatValidationErrors(error),
      ),
    );
  }

  // Express 5 makes `req.query` a getter with no usable setter — a plain
  // `req.query = value` assignment silently no-ops instead of throwing, so
  // the validated/coerced value (defaults, comma-split arrays, boolean and
  // number conversion) must be installed via defineProperty to actually
  // reach the controller.
  Object.defineProperty(req, 'query', {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  next();
};
