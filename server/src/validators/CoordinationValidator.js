import Joi from 'joi';
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
