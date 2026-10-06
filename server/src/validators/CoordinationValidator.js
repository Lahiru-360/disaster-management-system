import Joi from 'joi';
import { Priority } from '../enums/Priority.js';

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

  static pictureQuery = Joi.object({
    districtId: objectId,
    organisationId: objectId,
  });
}
