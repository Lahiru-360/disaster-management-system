import Joi from 'joi';
import { AlertHazardType } from '../enums/AlertHazardType.js';
import { ExportFormat } from '../enums/ExportFormat.js';
import { ReportSectionKey } from '../enums/ReportSectionKey.js';
import { SriLankaCalendar } from '../utils/SriLankaCalendar.js';

// Request schemas for /api/post-event-reports (UC04, contract §14). Only the
// shapes are checked here; the checks against the event itself (its status,
// period and districts) need the database, so PostEventReportService makes them.
export class PostEventReportValidator {
  // One rule, so a bad id gets one error rather than one per broken rule.
  static #id = Joi.string()
    .pattern(/^[0-9a-f]{24}$/i)
    .messages({ 'string.pattern.base': 'must be a valid id' });

  // A Sri Lanka calendar day, "YYYY-MM-DD" (§14.1).
  static #day = Joi.string()
    .custom((value, helpers) =>
      SriLankaCalendar.isDay(value) ? value : helpers.error('any.invalid'),
    )
    .messages({ 'any.invalid': 'must be a date as YYYY-MM-DD' });

  // POST /api/post-event-reports (§14.3).
  static generateSchema = Joi.object({
    eventId: PostEventReportValidator.#id.required(),
    from: PostEventReportValidator.#day.required(),
    to: PostEventReportValidator.#day.required(),
    districtIds: Joi.array()
      .items(PostEventReportValidator.#id)
      .min(1)
      .unique()
      .required()
      .messages({ 'array.min': 'must select at least one district' }),
    sections: Joi.array()
      .items(Joi.string().valid(...Object.values(ReportSectionKey)))
      .min(1)
      .unique()
      .required()
      .messages({ 'array.min': 'must select at least one section' }),
  });

  // POST /api/post-event-reports/:id/refine (§14.12). Each filter may be left
  // out or null; the service checks that one is set and that the district is
  // one of the report's.
  static refineSchema = Joi.object({
    hazardType: Joi.string()
      .valid(...Object.values(AlertHazardType))
      .allow(null)
      .messages({ 'any.only': `must be one of [${Object.values(AlertHazardType).join(', ')}]` }),
    districtId: PostEventReportValidator.#id.allow(null),
    organisationId: PostEventReportValidator.#id.allow(null),
  });

  // POST /api/post-event-reports/:id/exports (§14.8).
  static exportSchema = Joi.object({
    format: Joi.string()
      .valid(...Object.values(ExportFormat))
      .required()
      .messages({ 'any.only': `must be one of [${Object.values(ExportFormat).join(', ')}]` }),
  });

  // POST /api/post-event-reports/:id/shares (§14.9). The format defaults to
  // PDF and the message to the dialog's own default; a blank message is refused
  // rather than defaulted, since the officer cleared it.
  static shareSchema = Joi.object({
    format: Joi.string()
      .valid(...Object.values(ExportFormat))
      .default(ExportFormat.PDF)
      .messages({ 'any.only': `must be one of [${Object.values(ExportFormat).join(', ')}]` }),
    organisationId: PostEventReportValidator.#id.required(),
    recipientEmail: Joi.string()
      .trim()
      .max(254)
      .email({ tlds: { allow: false } })
      .required()
      .messages({ 'string.email': 'must be a valid email' }),
    message: Joi.string().trim().min(1).max(500).default('Post-event summary'),
  });

  // GET /api/post-event-reports?eventId= (§14.5). A well-formed id no report
  // belongs to is an empty list, not an error.
  static listQuery = Joi.object({
    eventId: PostEventReportValidator.#id.required(),
  });
}
