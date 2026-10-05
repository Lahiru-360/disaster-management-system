import { Citizen } from './Citizen.js';
import { CommunityVolunteer } from './CommunityVolunteer.js';
import { DistrictOfficer } from './DistrictOfficer.js';
import { DMCOfficer } from './DMCOfficer.js';
import { DutyOfficer } from './DutyOfficer.js';
import { RescueTeamLead } from './RescueTeamLead.js';

// Turns a stored role string into its Person class. It only lists the classes:
// each class names its own role, and which role inherits from which is the
// classes' own `extends` chain, so there is no second copy of the hierarchy
// here that could drift from them.
export class PersonFactory {
  static #CLASSES = [
    Citizen,
    CommunityVolunteer,
    DMCOfficer,
    DutyOfficer,
    DistrictOfficer,
    RescueTeamLead,
  ];

  static #BY_ROLE = new Map(
    PersonFactory.#CLASSES.map((PersonClass) => [PersonClass.role, PersonClass]),
  );

  static classes() {
    return [...PersonFactory.#CLASSES];
  }

  // Throws for an unknown role, so a mistyped role in route setup fails when
  // the route is declared rather than on the first request.
  static classFor(role) {
    const PersonClass = PersonFactory.#BY_ROLE.get(role);
    if (!PersonClass) {
      throw new Error(`Unknown role "${role}"`);
    }
    return PersonClass;
  }

  // The Person a User document stands for, or null when no class has its role
  // (e.g. an account left over from before the current roles existed). Every
  // profile field is passed on and each class keeps the ones it has, so a
  // Citizen gets homeDistrict and a DutyOfficer shiftDistrict. The districts
  // are passed as stored: an ObjectId, or the District document if the caller
  // populated it.
  static fromUser(user) {
    const PersonClass = PersonFactory.#BY_ROLE.get(user.role);
    if (!PersonClass) {
      return null;
    }
    const { name, phone, homeDistrict, district, shiftDistrict } = user;
    return new PersonClass({ name, phone, homeDistrict, district, shiftDistrict });
  }

  static selfRegistrableRoles() {
    return PersonFactory.#CLASSES
      .filter((PersonClass) => PersonClass.selfRegistrable)
      .map((PersonClass) => PersonClass.role);
  }
}
