import { Role } from '../../enums/Role.js';
import { Person } from './Person.js';

// Leads a rescue team in the field: acknowledges or declines assignments and
// updates their status.
export class RescueTeamLead extends Person {
  static role = Role.RESCUE_TEAM_LEAD;
}
