import Joi from 'joi';

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
