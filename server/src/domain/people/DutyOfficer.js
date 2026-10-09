import { Role } from '../../enums/Role.js';
import { DMCOfficer } from './DMCOfficer.js';

// A DMCOfficer tied to a shift district, who also reviews hazard reports.
// Inherits everything a DMCOfficer may do.
export class DutyOfficer extends DMCOfficer {
  static role = Role.DUTY_OFFICER;

  // The district they cover on shift, so the reports they review. Stored on
  // the User as a District ref (User.shiftDistrict).
  #shiftDistrict;

  constructor({ shiftDistrict, ...details } = {}) {
    super(details);
    this.#shiftDistrict = shiftDistrict;
  }

  get shiftDistrict() {
    return this.#shiftDistrict;
  }
}
