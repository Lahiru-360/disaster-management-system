import Joi from 'joi';
import { DispatchStatus } from '../enums/DispatchStatus.js';
import { Priority } from '../enums/Priority.js';
import { SupplyType } from '../enums/SupplyType.js';

// One rule, so a bad id gives one error, as the contract's errors array expects.
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({ 'string.pattern.base': '{#label} must be a valid id' });

// Query-string schemas for the UC03 coordination reads (contract §13). Only
// an id's shape is checked here; whether the caller may see that district,
// and whether it exists, is DistrictScope's decision.
export class CoordinationValidator {
  static districtQuery = Joi.object({
    districtId: objectId,
  });

  // UC03 step 7 (§13.6): the incident's position, and teams to leave out as
  // comma-separated ids (A3.3, the team that just declined).
  static availableQuery = Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    districtId: objectId,
    excludeTeamIds: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}(,[0-9a-fA-F]{24})*$/)
      .messages({ 'string.pattern.base': '{#label} must be comma-separated ids' })
      .custom((value) => value.split(',')),
  });

  // The officer console's dispatch list (§13.7.3): one DispatchStatus or
  // several separated by commas, e.g. "DECLINED,UNRESPONSIVE". Handed on as an array.
  static dispatchListQuery = Joi.object({
    districtId: objectId,
    status: Joi.string()
      .custom((value, helpers) => {
        const statuses = value.split(',');
        return statuses.every((status) => Object.values(DispatchStatus).includes(status))
          ? statuses
          : helpers.error('dispatch.status');
      })
      .messages({
        'dispatch.status': `{#label} must be DispatchStatus values separated by commas (${Object.values(DispatchStatus).join(', ')})`,
      }),
  });

  // UC03 steps 8-9 (§13.7.2).
  static dispatchBody = Joi.object({
    teamId: objectId.required(),
    incidentLocation: Joi.object({
      lat: Joi.number().strict().min(-90).max(90).required(),
      lng: Joi.number().strict().min(-180).max(180).required(),
      label: Joi.string().trim().max(200).allow(null),
    }).required(),
    priority: Joi.string()
      .valid(...Object.values(Priority))
      .required(),
  });

  // UC03 A3.1 (§13.8): why the lead turns the assignment down.
  static declineBody = Joi.object({
    reason: Joi.string().trim().min(1).max(200).required(),
  });

  // UC03 Log Relief Supply dialog (§13.11.1).
  static stockQuery = Joi.object({
    districtId: objectId,
    organisationId: objectId,
    supplyType: Joi.string().valid(...Object.values(SupplyType)),
  });

  // UC03 step 12 (§13.11.2). Whether the quantity fits the stock is the
  // ReliefStock domain rule (E5), which shows what is available.
  static distributionBody = Joi.object({
    shelterId: objectId.required(),
    stockId: objectId.required(),
    quantity: Joi.number().strict().required(),
  });

  static SHELTER_NAME_MAX_LENGTH = 100;

  static SHELTER_LABEL_MAX_LENGTH = 200;

  // The whole location is one rule, so every problem with the point or its
  // label lands on `location` with one message (contract §13.4.3). Returns
  // the point with its label trimmed, or without one.
  static #shelterLocation = Joi.any()
    .required()
    .custom((value, helpers) => {
      const { lat, lng, label } = value ?? {};
      if (
        typeof value !== 'object' ||
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !(lat >= -90 && lat <= 90) ||
        !(lng >= -180 && lng <= 180)
      ) {
        return helpers.error('location.malformed');
      }
      if (label !== undefined && label !== null) {
        const trimmed = typeof label === 'string' ? label.trim() : null;
        if (trimmed === null || trimmed.length > CoordinationValidator.SHELTER_LABEL_MAX_LENGTH) {
          return helpers.error('location.label');
        }
        return trimmed ? { lat, lng, label: trimmed } : { lat, lng };
      }
      return { lat, lng };
    })
    .messages({
      'any.required': 'is required',
      'location.malformed': 'must have a lat from -90 to 90 and a lng from -180 to 180',
      'location.label': `label must be text of at most ${CoordinationValidator.SHELTER_LABEL_MAX_LENGTH} characters`,
    });

  // UC03 A1 (§13.4.3): the new shelter's name, place and size. The district
  // is never taken from the body - it is the officer's own. Messages are
  // written without the field name, since `field` carries it.
  static shelterBody = Joi.object({
    name: Joi.string()
      .trim()
      .max(CoordinationValidator.SHELTER_NAME_MAX_LENGTH)
      .required()
      .messages({
        'any.required': 'is required',
        'string.empty': 'is required',
        'string.base': 'must be text',
        'string.max': `must be at most ${CoordinationValidator.SHELTER_NAME_MAX_LENGTH} characters`,
      }),
    location: CoordinationValidator.#shelterLocation,
    capacity: Joi.number().strict().integer().min(1).required().messages({
      'any.required': 'is required',
      'number.base': 'must be a whole number, 1 or more',
      'number.integer': 'must be a whole number, 1 or more',
      'number.min': 'must be a whole number, 1 or more',
      'number.infinity': 'must be a whole number, 1 or more',
    }),
  });

  // UC03 E1: a whole number of people, 0 or more (an empty shelter). A JSON
  // number only - "12" is refused rather than converted - and one message for
  // every way it can be wrong, as the contract shows (§13.4.2).
  static occupancyBody = Joi.object({
    occupants: Joi.number().strict().integer().min(0).required().messages({
      'number.base': '{#label} must be a whole number, 0 or more',
      'number.integer': '{#label} must be a whole number, 0 or more',
      'number.min': '{#label} must be a whole number, 0 or more',
      'number.infinity': '{#label} must be a whole number, 0 or more',
    }),
  });

  static pictureQuery = Joi.object({
    districtId: objectId,
    organisationId: objectId,
  });
}
