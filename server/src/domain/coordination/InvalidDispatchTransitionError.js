import { ApiError } from '../../utils/ApiError.js';

// UC03: a dispatch was asked to move in a way its current status doesn't
// allow - e.g. completing one that is only ASSIGNED, or acknowledging one that
// has already timed out. An ApiError, so it reaches the client as 409
// INVALID_DISPATCH_TRANSITION (contract §13.2) with no mapping in between.
export class InvalidDispatchTransitionError extends ApiError {
  /**
   * @param {string} currentStatus The dispatch's status now (a DispatchStatus).
   * @param {string} action What was attempted, e.g. "acknowledged".
   */
  constructor(currentStatus, action) {
    super(
      409,
      'INVALID_DISPATCH_TRANSITION',
      `This dispatch is ${currentStatus} and can't be ${action}.`,
    );
    this.name = 'InvalidDispatchTransitionError';
    this.currentStatus = currentStatus;
  }
}
