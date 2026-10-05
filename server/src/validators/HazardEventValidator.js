import Joi from 'joi';
import { EventStatus } from '../enums/EventStatus.js';

// Query-string schema for GET /api/hazard-events.
export class HazardEventValidator {
  static listQuery = Joi.object({
    status: Joi.string().valid(...Object.values(EventStatus)),
    // Only the id's shape is checked here: a well-formed id no event covers
    // matches nothing, which is an empty list rather than an error.
    districtId: Joi.string().hex().length(24),
  });
}
