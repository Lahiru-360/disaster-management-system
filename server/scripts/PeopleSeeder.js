import bcrypt from 'bcryptjs';
import { Role } from '../src/enums/Role.js';
import { User } from '../src/models/User.js';
import { Seeder } from './Seeder.js';

// Seeds one demo account per role. Safe to re-run: accounts are matched by
// email and only created when missing ($setOnInsert), so an existing one is
// never duplicated or overwritten. Expects an open connection - DatabaseSeeder
// owns it.
export class PeopleSeeder extends Seeder {
  static #PASSWORD = 'Password123!';

  static #SALT_ROUNDS = 10;

  // One account per role. The mobile app's demo picker (app/src/constants/
  // demoUsers.js) signs in as the field-role accounts; the officer accounts
  // are for the web portal. Officer and rescue team accounts can only be
  // created here or by direct database access - public registration only
  // accepts self-registrable roles.
  static #USERS = [
    { name: 'Nimal Perera', email: 'citizen@example.test', role: Role.CITIZEN },
    {
      name: 'Kamala Fernando',
      email: 'volunteer@example.test',
      role: Role.COMMUNITY_VOLUNTEER,
    },
    { name: 'Suresh Bandara', email: 'rescue.lead@example.test', role: Role.RESCUE_TEAM_LEAD },
    { name: 'Ruwan Jayasinghe', email: 'dmc.officer@example.test', role: Role.DMC_OFFICER },
    { name: 'Kasun Silva', email: 'duty.officer@example.test', role: Role.DUTY_OFFICER },
    {
      name: 'Dilani Wickramasinghe',
      email: 'district.officer@example.test',
      role: Role.DISTRICT_OFFICER,
    },
  ];

  async run() {
    const passwordHash = await bcrypt.hash(PeopleSeeder.#PASSWORD, PeopleSeeder.#SALT_ROUNDS);

    for (const { name, email, role } of PeopleSeeder.#USERS) {
      await User.findOneAndUpdate(
        { email },
        { $setOnInsert: { name, email, role, passwordHash } },
        { upsert: true, returnDocument: 'after' },
      );
      console.log(`Seeded ${role}: ${email}`);
    }
  }
}
