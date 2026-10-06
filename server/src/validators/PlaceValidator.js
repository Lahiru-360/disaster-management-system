import Joi from 'joi';

// Query schema for GET /api/places (contract §9.8).
export class PlaceValidator {
  static searchQuery = Joi.object({
    q: Joi.string().trim().min(2).max(50).required().messages({
      'any.required': 'is required',
      'string.empty': 'is required',
      'string.min': 'must be at least {#limit} characters',
      'string.max': 'must be at most {#limit} characters',
    }),
  });
}
