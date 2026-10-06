import Joi from 'joi';
import { isInsideSriLanka } from '../constants/geo.js';
import { LocationSource } from '../enums/LocationSource.js';
import { ReportHazardType } from '../enums/ReportHazardType.js';
import { ReportStatus } from '../enums/ReportStatus.js';

// Request schemas for the /api/hazard-reports endpoints (contract §9).
//
// The submit schema follows UC02 E1: one error per invalid field, always named
// by the top-level request field so the app can outline it directly - a bad
// point is reported as `location`, never `location.latitude`. Messages are
// written without the field name ("is required"), since `field` carries it.
export class HazardReportValidator {
  static DESCRIPTION_MAX_LENGTH = 200;

  // "must be one of [A, B]" for a closed list. The enum fields are Joi.any()
  // rather than Joi.string(), so a value of the wrong type (e.g. a number)
  // gives this one error, not a second "must be a string" on the same field.
  static #oneOf = (values) => ({ 'any.only': `must be one of [${values.join(', ')}]` });

  // The whole location is checked by one rule so every problem with it -
  // missing, not an object, non-numeric, outside Sri Lanka - lands on
  // `location` with one message.
  static #location = Joi.any()
    .required()
    .custom((value, helpers) => {
      const { latitude, longitude } = value ?? {};
      if (
        typeof value !== 'object' ||
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return helpers.error('location.malformed');
      }
      if (!isInsideSriLanka({ latitude, longitude })) {
        return helpers.error('location.outsideSriLanka');
      }
      return { latitude, longitude };
    })
    .messages({
      'any.required': 'is required',
      'location.malformed': 'must have a numeric latitude and longitude',
      'location.outsideSriLanka': 'must be inside Sri Lanka',
    });

  static submitSchema = Joi.object({
    description: Joi.string()
      .trim()
      .max(HazardReportValidator.DESCRIPTION_MAX_LENGTH)
      .required()
      .messages({
        'any.required': 'is required',
        'string.empty': 'is required',
        'string.base': 'must be text',
        'string.max': 'must be at most {#limit} characters',
      }),
    hazardType: Joi.any()
      .valid(...Object.values(ReportHazardType))
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardReportValidator.#oneOf(Object.values(ReportHazardType)),
      }),
    location: HazardReportValidator.#location,
    locationSource: Joi.any()
      .valid(...Object.values(LocationSource))
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardReportValidator.#oneOf(Object.values(LocationSource)),
      }),
    photoUrl: Joi.string()
      .trim()
      .uri({ scheme: ['http', 'https'] })
      .required()
      .messages({
        'any.required': 'is required',
        'string.empty': 'is required',
        'string.base': 'must be a URL',
        'string.uri': 'must be a URL',
        'string.uriCustomScheme': 'must be a URL',
      }),
    clientReportId: Joi.string().guid({ version: 'uuidv4' }).messages({
      'string.base': 'must be a UUID v4',
      'string.guid': 'must be a UUID v4',
    }),
  });

  // GET /api/hazard-reports?status=PENDING (§9.4). Only the pending queue
  // exists for now, so PENDING is the one accepted value.
  static queueQuery = Joi.object({
    status: Joi.any()
      .valid(ReportStatus.PENDING)
      .required()
      .messages({
        'any.required': 'is required',
        ...HazardReportValidator.#oneOf([ReportStatus.PENDING]),
      }),
  });
}
