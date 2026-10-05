import { ApiError } from '../../utils/ApiError.js';

// UC02 E3: a duty officer tried to confirm or dismiss a report that is no
// longer PENDING, usually because a colleague got there first. An ApiError, so
// it reaches the client as 409 REPORT_ALREADY_REVIEWED (contract §9.6) with no
// mapping in between, and it names the status the report is now in.
export class ReportAlreadyReviewedError extends ApiError {
  /**
   * @param {string} currentStatus The report's status now (a ReportStatus).
   */
  constructor(currentStatus) {
    super(409, 'REPORT_ALREADY_REVIEWED', `Already reviewed – current status: ${currentStatus}`);
    this.name = 'ReportAlreadyReviewedError';
    this.currentStatus = currentStatus;
  }
}
