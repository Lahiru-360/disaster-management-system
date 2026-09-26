import { Role } from '../../enums/Role.js';
import { Person } from './Person.js';

// Disaster Management Centre officer: issues, updates and ends warnings, views
// the combined operational picture and generates post-event reports.
export class DMCOfficer extends Person {
  static role = Role.DMC_OFFICER;
}
