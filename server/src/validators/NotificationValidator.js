import Joi from 'joi';

// Query schema for GET /api/notifications/me (api-contract §11.2).
export class NotificationValidator {
  static MAX_LIMIT = 50;

  static listSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(NotificationValidator.MAX_LIMIT).default(20),
  });
}
