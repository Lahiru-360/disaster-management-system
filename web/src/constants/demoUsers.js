import { ROLES } from './roles';

// The demo accounts, one per role. A copy of app/src/constants/demoUsers.js -
// keep the two in sync, and both in step with the server's seed script
// (server/scripts/DatabaseSeeder.js), which creates the same accounts. The
// mock API signs in against this whole list; the login page's demo picker
// shows only the officer accounts. `label` is what the picker shows; `name` is
// the account's own name, shown once signed in.
export const DEMO_PASSWORD = 'Password123!';

export const DEMO_USERS = [
  {
    label: 'Citizen – Nimal',
    name: 'Nimal Perera',
    email: 'citizen@example.test',
    role: ROLES.CITIZEN,
  },
  {
    label: 'Community Volunteer – Kamala',
    name: 'Kamala Fernando',
    email: 'volunteer@example.test',
    role: ROLES.COMMUNITY_VOLUNTEER,
  },
  {
    label: 'Rescue Team Lead – Suresh',
    name: 'Suresh Bandara',
    email: 'rescue.lead@example.test',
    role: ROLES.RESCUE_TEAM_LEAD,
  },
  {
    label: 'DMC Officer – Ruwan',
    name: 'Ruwan Jayasinghe',
    email: 'dmc.officer@example.test',
    role: ROLES.DMC_OFFICER,
  },
  {
    label: 'Duty Officer – Colombo',
    name: 'Kasun Silva',
    email: 'duty.officer@example.test',
    role: ROLES.DUTY_OFFICER,
  },
  {
    label: 'District Officer – Gampaha',
    name: 'Dilani Wickramasinghe',
    email: 'district.officer@example.test',
    role: ROLES.DISTRICT_OFFICER,
  },
];
