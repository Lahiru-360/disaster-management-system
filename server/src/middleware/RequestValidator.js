import { ApiError } from '../utils/ApiError.js';

// Validates the request body or query string against a Joi schema. On success
// the validated value (defaults applied, unknown keys stripped) replaces the
// original, so handlers only ever see validated input.
export class RequestValidator {
  static body(schema) {
    return (req, res, next) => {
      const { error, value } = RequestValidator.#validate(schema, req.body);

      if (error) {
        return next(RequestValidator.#validationError(error));
      }

      req.body = value;
      next();
    };
  }

  static query(schema) {
    return (req, res, next) => {
      const { error, value } = RequestValidator.#validate(schema, req.query);

      if (error) {
        return next(RequestValidator.#validationError(error));
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
  }

  static #validate(schema, input) {
    return schema.validate(input, {
      abortEarly: false,
      stripUnknown: true,
    });
  }

  static #validationError(error) {
    return new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed.',
      error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
      })),
    );
  }
}
