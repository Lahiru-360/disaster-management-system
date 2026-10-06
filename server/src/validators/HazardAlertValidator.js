import Joi from 'joi';
import { AlertHazardType } from '../enums/AlertHazardType.js';
import { SeverityLevel } from '../enums/SeverityLevel.js';

// Request schemas for the /api/hazard-alerts endpoints (contract §12). Errors
// are named by the top-level request field, and messages are written without
// the field name, since `field` carries it.
export class HazardAlertValidator {
  static MESSAGE_MAX_LENGTH = 160;

  static #oneOf = (values) => ({ 'any.only': `must be one of [${values.join(', ')}]` });

  static #severity = Joi.any()
    .valid(...Object.values(SeverityLevel))
    .messages(HazardAlertValidator.#oneOf(Object.values(SeverityLevel)));

  // Whether each area id is a registered district or basin is the service's
  // check (E1), so a malformed id is reported with the unknown ones, on
  // areaIds. Anything but text in the list is refused here, on areaIds as a
  // whole.
  static #areaIds = Joi.array()
    .min(1)
    .custom((ids, helpers) =>
      ids.every((id) => typeof id === 'string') ? ids : helpers.error('array.base'),
    )
    .messages({
      'any.required': 'is required',
      'array.base': 'must be a list of area ids',
      'array.min': 'must contain at least {#limit} items',
    });

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

  // POST /api/hazard-alerts (§12.2, §12.10): an optional confirmed report to
  // escalate (UC01 A1). Whether it exists and is CONFIRMED is the service's
  // check, so a malformed id is a 404 like an unknown one. Anything else sent
  // is ignored.
  static startSchema = Joi.object({
    sourceReportId: Joi.string().trim().messages({
      'string.base': 'must be a report id',
      'string.empty': 'must be a report id',
    }),
  });

  // GET /api/hazard-alerts (§12.11): only the drafts for now (A4); DMS-124
  // adds the active warnings.
  static listQuery = Joi.object({
    status: Joi.string()
      .valid('draft')
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardAlertValidator.#oneOf(['draft']),
      }),
  });

  // POST /api/hazard-alerts/:id/preview (§12.3).
  static previewSchema = Joi.object({
    hazardType: Joi.any()
      .valid(...Object.values(AlertHazardType))
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardAlertValidator.#oneOf(Object.values(AlertHazardType)),
      }),
    severity: HazardAlertValidator.#severity.required().messages({ 'any.required': 'is required' }),
    areaIds: HazardAlertValidator.#areaIds.required(),
  });

  // PATCH /api/hazard-alerts/:id/draft (§12.4).
  static draftMessageSchema = Joi.object({ message: HazardAlertValidator.#message });

  // POST /api/hazard-alerts/:id/broadcast (§12.6): the text as the officer last
  // saw it in the confirmation dialog.
  static broadcastSchema = Joi.object({ message: HazardAlertValidator.#message });

  // An update (UC01 A2) changes the severity, the scope or both; the hazard
  // type never changes. Neither given is reported on severity.
  static #change = {
    severity: HazardAlertValidator.#severity,
    areaIds: HazardAlertValidator.#areaIds,
  };

  static #needsChange = (value, helpers) =>
    value.severity === undefined && value.areaIds === undefined
      ? helpers.error(
          'any.custom',
          { message: 'change the severity or the scope' },
          { ...helpers.state, path: ['severity'] },
        )
      : value;

  static #changeMessages = { 'any.custom': '{#message}' };

  // POST /api/hazard-alerts/:id/update-preview (§12.13).
  static updatePreviewSchema = Joi.object(HazardAlertValidator.#change)
    .custom(HazardAlertValidator.#needsChange)
    .messages(HazardAlertValidator.#changeMessages);

  // PATCH /api/hazard-alerts/:id (§12.14): the change, the update message as
  // the officer last saw it, and the new draft it replaces, if any.
  static updateSchema = Joi.object({
    ...HazardAlertValidator.#change,
    message: HazardAlertValidator.#message,
    replacesDraftId: Joi.string().trim().messages({
      'string.base': 'must be an alert id',
      'string.empty': 'must be an alert id',
    }),
  })
    .custom(HazardAlertValidator.#needsChange)
    .messages(HazardAlertValidator.#changeMessages);
}
