import Joi from 'joi';
import { AlertHazardType } from '../enums/AlertHazardType.js';
import { SeverityLevel } from '../enums/SeverityLevel.js';

// Request schemas for the /api/hazard-alerts endpoints (contract §12). Errors
// are named by the top-level request field, and messages are written without
// the field name, since `field` carries it.
export class HazardAlertValidator {
  static MESSAGE_MAX_LENGTH = 160;

  static #oneOf = (values) => ({ 'any.only': `must be one of [${values.join(', ')}]` });

  // Fits in one SMS (UC01 step 8).
  static #message = Joi.string()
    .trim()
    .max(HazardAlertValidator.MESSAGE_MAX_LENGTH)
    .required()
    .messages({
      'any.required': 'is required',
      'string.empty': 'is required',
      'string.base': 'must be text',
      'string.max': 'length must be less than or equal to {#limit} characters long',
    });

  // POST /api/hazard-alerts (§12.2): no fields yet; anything sent is ignored.
  static startSchema = Joi.object({});

  // POST /api/hazard-alerts/:id/preview (§12.3). Whether each area id is a
  // registered district or basin is the service's check (E1), so a malformed
  // id is reported with the unknown ones, on areaIds.
  static previewSchema = Joi.object({
    hazardType: Joi.any()
      .valid(...Object.values(AlertHazardType))
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardAlertValidator.#oneOf(Object.values(AlertHazardType)),
      }),
    severity: Joi.any()
      .valid(...Object.values(SeverityLevel))
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardAlertValidator.#oneOf(Object.values(SeverityLevel)),
      }),
    areaIds: Joi.array().items(Joi.any()).min(1).required().messages({
      'any.required': 'is required',
      'array.base': 'must be a list of area ids',
      'array.min': 'must contain at least {#limit} items',
    }),
  });

  // PATCH /api/hazard-alerts/:id/draft (§12.4).
  static draftMessageSchema = Joi.object({ message: HazardAlertValidator.#message });

  // POST /api/hazard-alerts/:id/broadcast (§12.6): the text as the officer last
  // saw it in the confirmation dialog.
  static broadcastSchema = Joi.object({ message: HazardAlertValidator.#message });
}
