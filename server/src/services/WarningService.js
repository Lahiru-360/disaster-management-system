import mongoose from 'mongoose';
import { HazardAlert } from '../domain/alerts/HazardAlert.js';
import { MessageTemplate } from '../domain/alerts/MessageTemplate.js';
import { ReportHazardTypeMapper } from '../domain/alerts/ReportHazardTypeMapper.js';
import { Channel } from '../enums/Channel.js';
import { EventStatus } from '../enums/EventStatus.js';
import { HazardAlert as HazardAlertModel } from '../models/HazardAlert.js';
import { HazardEvent as HazardEventModel } from '../models/HazardEvent.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { areaRegistry as defaultAreaRegistry } from './AreaRegistry.js';
import { citizenRegistry as defaultCitizenRegistry } from './CitizenRegistry.js';
import { hazardReportService as defaultReportService } from './HazardReportService.js';
import { HazardAlertPresenter } from './HazardAlertPresenter.js';
import { ReferenceNumberGenerator } from './ReferenceNumberGenerator.js';

// UC01 Issue Hazard Warning, composing (main flow steps 1-8): the
// WarningController's work in the sequence diagram up to the confirmation.
// The controller hands it validated input; it asks the HazardAlert domain
// class for every change, AreaRegistry for the scope, CitizenRegistry for the
// reach and MessageTemplate for the text. Nothing here sends anything. A
// draft escalated from a confirmed report (A1) reads that report only through
// UC02's HazardReportService (X-1), never its model. Every collaborator comes
// through the constructor.
export class WarningService {
  #alertModel;
  #eventModel;
  #areaRegistry;
  #citizenRegistry;
  #reportService;
  #messageTemplate;
  #referenceNumbers;
  #channels;
  #clock;

  constructor({
    alertModel = HazardAlertModel,
    eventModel = HazardEventModel,
    areaRegistry = defaultAreaRegistry,
    citizenRegistry = defaultCitizenRegistry,
    reportService = defaultReportService,
    messageTemplate = MessageTemplate,
    referenceNumbers = new ReferenceNumberGenerator({ counterName: 'hazardAlert', prefix: 'HA' }),
    channels = Object.values(Channel),
    clock = systemClock,
  } = {}) {
    this.#alertModel = alertModel;
    this.#eventModel = eventModel;
    this.#areaRegistry = areaRegistry;
    this.#citizenRegistry = citizenRegistry;
    this.#reportService = reportService;
    this.#messageTemplate = messageTemplate;
    this.#referenceNumbers = referenceNumbers;
    this.#channels = channels;
    this.#clock = clock;
  }

  /**
   * Step 2: opens a new DRAFT, version 1, with a new HA- reference, as soon as
   * the officer starts composing.
   * @param {{ id: string }} officer The signed-in DMC or duty officer.
   * @returns {Promise<object>} The alert object (contract §12.1).
   */
  async startDraft(officer) {
    return this.#createDraft(officer, null);
  }

  /**
   * A1.1-A1.2: opens a DRAFT linked to a CONFIRMED hazard report, with the
   * values to pre-fill. Nothing else is set on the draft: the officer confirms
   * or changes the suggestions in the first preview, from step 4 on.
   * @param {{ id: string }} officer The signed-in DMC or duty officer.
   * @param {string} reportId The hazard report to escalate.
   * @returns {Promise<{ alert: object, prefill: { hazardType: string|null, districtId: string, reportRef: { id: string, referenceNo: string } } }>}
   * @throws {ApiError} 404 for an unknown report, 409 if it isn't CONFIRMED.
   */
  async escalateFromReport(officer, reportId) {
    const prefill = await this.prefillFromReport(reportId);
    const alert = await this.#createDraft(officer, prefill.reportRef.id);
    return { alert, prefill };
  }

  /**
   * A1.2 (prefillFromReport in the sequence diagram): what an escalated report
   * suggests for the warning. The hazard type comes from the report's type
   * (null for a ground-impact report) and the district from its coordinates,
   * or the district the report was filed under when no district is near them.
   * @param {string} reportId
   * @returns {Promise<{ hazardType: string|null, districtId: string, reportRef: { id: string, referenceNo: string } }>}
   * @throws {ApiError} 404 for an unknown or malformed id, 409 if the report
   *   isn't CONFIRMED.
   */
  async prefillFromReport(reportId) {
    const report = await this.#reportService.findById(reportId);
    if (!report) {
      throw new ApiError(404, 'NOT_FOUND', 'Hazard report not found.');
    }
    if (!report.isEscalatable) {
      throw new ApiError(
        409,
        'REPORT_NOT_ESCALATABLE',
        `Only a confirmed report can be escalated – current status: ${report.status}`,
      );
    }
    const { latitude, longitude } = report.location;
    const district = await this.#areaRegistry.findDistrictForPoint(latitude, longitude);
    return {
      hazardType: ReportHazardTypeMapper.toAlertHazardType(report.hazardType),
      districtId: district ? String(district.areaId) : report.district.id,
      reportRef: { id: report.id, referenceNo: report.referenceNo },
    };
  }

  /**
   * Steps 3-7: validates the scope (E1), counts the citizens it reaches once
   * each, generates the message, links the covering ACTIVE event, and stores
   * all of it on the draft.
   * @param {string} alertId
   * @param {{ hazardType: string, severity: string, areaIds: string[] }} preview
   * @returns {Promise<{ alert: object, recipientCount: number, message: string,
   *   channels: { channel: string, ready: boolean }[], activeWarning: object|null }>}
   * @throws {ApiError} 404 for an unknown alert, 400 for an invalid scope, 409
   *   if it is no longer a DRAFT.
   */
  async preview(alertId, { hazardType, severity, areaIds }) {
    const doc = await this.#findDoc(alertId);
    const areas = await this.#validScope(areaIds);
    const districtIds = this.#areaRegistry.expandToDistricts(areas);

    const [recipientCount, event] = await Promise.all([
      this.#citizenRegistry.countRecipients(districtIds),
      this.#coveringEvent(hazardType, districtIds),
    ]);
    const message = this.#messageTemplate.generate(hazardType, severity);

    const alert = HazardAlert.fromDocument(doc);
    alert.compose({ hazardType, severity, targets: areas, message, event });
    doc.set(alert.toFields());
    await doc.save();

    return {
      alert: await HazardAlertPresenter.present(doc),
      recipientCount,
      message,
      channels: this.#channels.map((channel) => ({ channel, ready: true })),
      // The active-warning check (UC01 A2) is DMS-123.
      activeWarning: null,
    };
  }

  /**
   * Step 8: saves the officer's edit of the message on the draft.
   * @param {string} alertId
   * @param {string} message At most 160 characters (checked by the validator).
   * @returns {Promise<object>} The alert object.
   * @throws {ApiError} 404 for an unknown alert, 409 if it is no longer a DRAFT.
   */
  async saveDraftMessage(alertId, message) {
    const doc = await this.#findDoc(alertId);
    const alert = HazardAlert.fromDocument(doc);
    alert.editMessage(message);
    doc.set(alert.toFields());
    await doc.save();
    return HazardAlertPresenter.present(doc);
  }

  /**
   * One alert in any status (contract §12.5).
   * @param {string} alertId
   * @returns {Promise<object>} The alert object.
   * @throws {ApiError} 404 for an unknown or malformed id.
   */
  async findById(alertId) {
    return HazardAlertPresenter.present(await this.#findDoc(alertId));
  }

  async #createDraft(officer, sourceReport) {
    const referenceNo = await this.#referenceNumbers.next();
    const alert = HazardAlert.startDraft({
      referenceNo,
      officer,
      at: this.#clock.now(),
      sourceReport,
    });
    const doc = await this.#alertModel.create({
      referenceNo,
      createdBy: alert.createdById,
      ...alert.toFields(),
    });
    return HazardAlertPresenter.present(doc);
  }

  async #findDoc(alertId) {
    const doc = mongoose.isValidObjectId(alertId) ? await this.#alertModel.findById(alertId) : null;
    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Hazard alert not found.');
    }
    return doc;
  }

  // The registered areas for the ids, or a 400 on areaIds naming every id
  // that isn't one (UC01 E1).
  async #validScope(areaIds = []) {
    const { areas, unknownIds } = await this.#areaRegistry.validateAreas(areaIds);
    if (unknownIds.length > 0) {
      throw WarningService.#scopeError(`unknown area ids: ${unknownIds.join(', ')}`);
    }
    if (areas.length === 0) {
      throw WarningService.#scopeError('must contain at least 1 items');
    }
    return areas;
  }

  // The ACTIVE event of the same hazard type that affects any of the
  // districts: the one sharing the most, then the most recently started.
  async #coveringEvent(hazardType, districtIds) {
    const events = await this.#eventModel
      .find({ status: EventStatus.ACTIVE, hazardType, districts: { $in: districtIds } })
      .sort({ startDate: -1 })
      .lean();
    const shared = (event) =>
      event.districts.filter((id) => districtIds.includes(String(id))).length;
    return (
      events.reduce((best, event) => (!best || shared(event) > shared(best) ? event : best), null)
        ?._id ?? null
    );
  }

  static #scopeError(message) {
    return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'areaIds', message },
    ]);
  }
}

export const warningService = new WarningService();
