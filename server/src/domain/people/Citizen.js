import { Role } from '../../enums/Role.js';
import { Person } from './Person.js';

// A member of the public: submits hazard reports and receives warnings.
export class Citizen extends Person {
  static role = Role.CITIZEN;

  static selfRegistrable = true;

  // The district the citizen lives in, which decides which alerts reach them.
  // Stored on the User as a District ref (User.homeDistrict).
  #homeDistrict;

  constructor({ homeDistrict, ...details } = {}) {
    super(details);
    this.#homeDistrict = homeDistrict;
  }

  get homeDistrict() {
    return this.#homeDistrict;
  }
}
