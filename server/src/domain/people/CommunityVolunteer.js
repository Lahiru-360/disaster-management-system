import { Role } from '../../enums/Role.js';
import { Citizen } from './Citizen.js';

// A Citizen with a training level. Inherits everything a Citizen may do,
// including self-registration.
export class CommunityVolunteer extends Citizen {
  static role = Role.COMMUNITY_VOLUNTEER;

  // Not persisted yet, and the levels themselves are still to be agreed, so
  // this is whatever the caller passes in.
  #trainingLevel;

  constructor({ trainingLevel, ...details } = {}) {
    super(details);
    this.#trainingLevel = trainingLevel;
  }

  get trainingLevel() {
    return this.#trainingLevel;
  }
}
