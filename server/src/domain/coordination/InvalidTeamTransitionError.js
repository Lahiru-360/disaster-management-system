import { ApiError } from '../../utils/ApiError.js';

// UC03 E4: a team was marked available while it is out on a dispatch. An
// ApiError, so it reaches the client as 409 INVALID_TEAM_TRANSITION (contract
// §13.10.1) with no mapping in between.
export class InvalidTeamTransitionError extends ApiError {
  /**
   * @param {string} name The team's name.
   * @param {string} currentStatus The team's status now (a TeamStatus).
   */
  constructor(name, currentStatus) {
    super(
      409,
      'INVALID_TEAM_TRANSITION',
      `${name} is ${currentStatus}; it becomes available when its dispatch is completed.`,
    );
    this.name = 'InvalidTeamTransitionError';
    this.currentStatus = currentStatus;
  }
}
