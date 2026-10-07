import { ApiError } from '../../utils/ApiError.js';

// A hazard alert was asked to do something its status doesn't allow, e.g.
// broadcast an alert that is no longer DRAFT, possibly because a colleague
// got there first. An ApiError, so it reaches the client as 409
// INVALID_ALERT_TRANSITION (contract §12.8) with no mapping in between.
export class InvalidAlertTransitionError extends ApiError {
  /**
   * @param {string} message What was refused, naming the current status.
   * @param {string} currentStatus The alert's status now (an AlertStatus).
   */
  constructor(message, currentStatus) {
    super(409, 'INVALID_ALERT_TRANSITION', message);
    this.name = 'InvalidAlertTransitionError';
    this.currentStatus = currentStatus;
  }
}
