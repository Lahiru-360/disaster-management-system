import { Role } from '../../enums/Role.js';
import { DMCOfficer } from './DMCOfficer.js';

// A DMCOfficer tied to a shift district, who also reviews hazard reports.
// Inherits everything a DMCOfficer may do.
export class DutyOfficer extends DMCOfficer {
  static role = Role.DUTY_OFFICER;

  // A district name for now; becomes a District once that class exists.
  // Not persisted yet.
  #shiftDistrict;

  constructor({ shiftDistrict, ...details } = {}) {
    super(details);
    this.#shiftDistrict = shiftDistrict;
  }

  get shiftDistrict() {
    return this.#shiftDistrict;
  }
}
