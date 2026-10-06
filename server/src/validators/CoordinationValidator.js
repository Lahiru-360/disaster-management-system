import Joi from 'joi';
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

  static pictureQuery = Joi.object({
    districtId: objectId,
    organisationId: objectId,
  });
}
