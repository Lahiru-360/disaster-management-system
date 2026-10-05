import Joi from 'joi';
import { OrgType } from '../enums/OrgType.js';

// Query-string schema for GET /api/organisations.
export class OrganisationValidator {
  static listQuery = Joi.object({
    type: Joi.string().valid(...Object.values(OrgType)),
  });
}
