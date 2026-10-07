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
// wrong id never leaves a file behind. Nothing is recorded when the email
// can't be sent (the FAILED record belongs to E4, DMS-162).
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
   *   STORAGE_UNAVAILABLE when a missing export can't be made, 502 EMAIL_UNAVAILABLE
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

    const email = new ReportShareEmail({
      eventName: report.event.name,
      hazardType: report.event.hazardType,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      sharedByName: officer.name,
      message,
      fileUrl: exported.fileUrl,
      format: exported.format,
    });
    await this.#emailService.send({ to: recipientEmail, ...email.render() });

    const saved = await this.#shareModel.create({
      report: report.id,
      export: exported.exportId,
      organisation: organisation._id,
      recipientEmail,
      message,
      sharedBy: officer.id,
      sharedAt: this.#clock.now(),
      status: ShareStatus.SENT,
    });
    return ReportSharePresenter.present(saved);
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
}

export const shareService = new ShareService();
