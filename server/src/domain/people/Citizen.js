import { Role } from '../../enums/Role.js';
import { Person } from './Person.js';

// A member of the public: submits hazard reports and receives warnings.
export class Citizen extends Person {
  static role = Role.CITIZEN;

  static selfRegistrable = true;
}
