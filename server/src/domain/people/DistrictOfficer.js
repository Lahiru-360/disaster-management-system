import { Role } from '../../enums/Role.js';
import { Person } from './Person.js';

// Manages shelters, dispatches rescue teams and logs relief supplies for
// their district.
export class DistrictOfficer extends Person {
  static role = Role.DISTRICT_OFFICER;

  // The district they are responsible for. Stored on the User as a District
  // ref (User.district).
  #district;

  constructor({ district, ...details } = {}) {
    super(details);
    this.#district = district;
  }

  get district() {
    return this.#district;
  }
}
