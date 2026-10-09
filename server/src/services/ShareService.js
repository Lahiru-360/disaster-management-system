import mongoose from 'mongoose';
import { ExportFormat } from '../enums/ExportFormat.js';
import { ShareStatus } from '../enums/ShareStatus.js';
import { Organisation as OrganisationModel } from '../models/Organisation.js';
import { ReportShare as ReportShareModel } from '../models/ReportShare.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { emailService as defaultEmailService } from './EmailService.js';
import { ReportShareEmail } from './email/ReportShareEmail.js';
import { exportService as defaultExportService } from './ExportService.js';
import { postEventReportService as defaultReportService } from './PostEventReportService.js';
import { ReportSharePresenter } from './reports/ReportSharePresenter.js';

// UC04 steps 14-15 (contract §14.9): shares a stored post-event report with an
// organisation's contact. Share report «include»s Export report, so it uses
// the report's newest export in the chosen format, or makes one first. It then
// emails the file link through the EmailService and records the share.
//
// The report and the organisation are checked before an export is made, so a
// wrong id never leaves a file behind.
//
// E4: when the email can't be sent, the share is still recorded, as FAILED
// with the reason, and the export and its file are kept. The officer can then
// retry the same share, which updates that record instead of adding another.
export class ShareService {
  #reportService;
  #exportService;
  #organisationModel;
  #shareModel;
  #emailService;
  #clock;

  constructor({
    reportService = defaultReportService,
    exportService = defaultExportService,
    organisationModel = OrganisationModel,
    shareModel = ReportShareModel,
    emailService = defaultEmailService,
    clock = systemClock,
  } = {}) {
    this.#reportService = reportService;
    this.#exportService = exportService;
    this.#organisationModel = organisationModel;
    this.#shareModel = shareModel;
    this.#emailService = emailService;
    this.#clock = clock;
  }

  /**
   * Emails the report's file to the recipient and records the share (§14.9).
   * @param {{ id: string, name: string }} officer the signed-in DMC or duty officer
   * @param {string} reportId
   * @param {{ format?: string, organisationId: string, recipientEmail: string, message: string }} input
   * @returns {Promise<object>} the share object (§14.9)
   * @throws {ApiError} 404 NOT_FOUND for the report or organisation, 500 EXPORT_FAILED / 502
   *   STORAGE_UNAVAILABLE when a missing export can't be made, and for E4 502
   *   EMAIL_UNAVAILABLE after recording the share as FAILED
   */
  async share(
    officer,
    reportId,
    { format = ExportFormat.PDF, organisationId, recipientEmail, message },
  ) {
    const report = await this.#reportService.findById(reportId);
    const organisation = await this.#organisationModel.findById(organisationId);
    if (!organisation) {
      throw new ApiError(404, 'NOT_FOUND', 'Organisation not found.');
    }

    const exported = await this.#exportService.findOrCreate(officer, report.id, format);

    const failure = await this.#send(report, {
      recipientEmail,
      message,
      sharedByName: officer.name,
      fileUrl: exported.fileUrl,
      format: exported.format,
    });
    const saved = await this.#shareModel.create({
      report: report.id,
      export: exported.exportId,
      organisation: organisation._id,
      recipientEmail,
      message,
      sharedBy: officer.id,
      sharedAt: this.#clock.now(),
      status: failure ? ShareStatus.FAILED : ShareStatus.SENT,
      attempts: 1,
      failureReason: failure ? failure.reason : null,
    });
    if (failure) {
      throw failure.error;
    }
    return ReportSharePresenter.present(saved);
  }

  /**
   * E4.2: sends a FAILED share again (contract §14.11). On success the same
   * share becomes SENT with a new sharedAt; if it fails again it stays FAILED.
   * Either way `attempts` goes up by one and no second record is made.
   * @param {string} shareId
   * @returns {Promise<object>} the share object
   * @throws {ApiError} 404 NOT_FOUND, 409 INVALID_SHARE_TRANSITION when the share isn't
   *   FAILED, 502 EMAIL_UNAVAILABLE when it fails again
   */
  async retry(shareId) {
    const share = mongoose.isValidObjectId(shareId)
      ? await this.#shareModel.findById(shareId).populate(ReportSharePresenter.POPULATE)
      : null;
    if (!share) {
      throw new ApiError(404, 'NOT_FOUND', 'Report share not found.');
    }
    if (share.status !== ShareStatus.FAILED) {
      throw new ApiError(
        409,
        'INVALID_SHARE_TRANSITION',
        `Only a FAILED share can be retried – current status: ${share.status}`,
      );
    }

    const report = await this.#reportService.findById(String(share.report));
    const failure = await this.#send(report, {
      recipientEmail: share.recipientEmail,
      message: share.message,
      sharedByName: share.sharedBy?.name ?? 'a DMC officer',
      fileUrl: share.export.fileUrl,
      format: share.export.format,
    });

    share.attempts += 1;
    if (failure) {
      share.failureReason = failure.reason;
    } else {
      share.status = ShareStatus.SENT;
      share.sharedAt = this.#clock.now();
      share.failureReason = null;
    }
    await share.save();
    if (failure) {
      throw failure.error;
    }
    return ReportSharePresenter.listItem(share.toObject());
  }

  /**
   * A report's shares, newest first, for the report view (§14.10).
   * @param {string} reportId
   * @returns {Promise<object[]>}
   * @throws {ApiError} 404 NOT_FOUND when the report doesn't exist
   */
  async listForReport(reportId) {
    const report = await this.#reportService.findById(reportId);
    const docs = await this.#shareModel
      .find({ report: report.id })
      .sort({ sharedAt: -1, _id: -1 })
      .populate(ReportSharePresenter.POPULATE)
      .lean();
    return docs.map((doc) => ReportSharePresenter.listItem(doc));
  }

  // Renders the share email and sends it. Returns null when it went out, or
  // the 502 EMAIL_UNAVAILABLE to answer with and the reason to record.
  async #send(report, { recipientEmail, message, sharedByName, fileUrl, format }) {
    const email = new ReportShareEmail({
      eventName: report.event.name,
      hazardType: report.event.hazardType,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      sharedByName,
      message,
      fileUrl,
      format,
    });
    try {
      await this.#emailService.send({ to: recipientEmail, ...email.render() });
      return null;
    } catch (err) {
      return {
        reason: String(err.message || 'The email could not be sent.').slice(0, 500),
        error:
          err instanceof ApiError
            ? err
            : new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.'),
      };
    }
  }
}

export const shareService = new ShareService();
