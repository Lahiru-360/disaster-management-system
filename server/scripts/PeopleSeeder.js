import bcrypt from 'bcryptjs';
import { Role } from '../src/enums/Role.js';
import { District } from '../src/models/District.js';
import { User } from '../src/models/User.js';
import { Seeder } from './Seeder.js';
import { SyntheticCitizenGenerator } from './SyntheticCitizenGenerator.js';

// Seeds one demo account per role, then the synthetic citizens. Safe to re-run:
// accounts are matched by email and only created when missing ($setOnInsert),
// so an existing one is never duplicated and its name, role and password are
// never overwritten. The profile fields (districts, phone) are $set on every
// run, so an account seeded before they existed gets them too. Expects an open
// connection and the districts already seeded - DatabaseSeeder owns both.
export class PeopleSeeder extends Seeder {
  static #PASSWORD = 'Password123!';

  static #SALT_ROUNDS = 10;

  // One account per role. The mobile app's demo picker (app/src/constants/
  // demoUsers.js) signs in as the field-role accounts; the officer accounts
  // are for the web portal. Officer and rescue team accounts can only be
  // created here or by direct database access - public registration only
  // accepts self-registrable roles. `profile` names the districts as the
  // wireframes show them; the rescue team lead has none of their own, since
  // they are attached to Team Alpha (Gampaha) through the team (DMS-140).
  static #USERS = [
    {
      name: 'Nimal Perera',
      email: 'citizen@example.test',
      role: Role.CITIZEN,
      profile: { homeDistrict: 'Colombo' },
    },
    {
      name: 'Kamala Fernando',
      email: 'volunteer@example.test',
      role: Role.COMMUNITY_VOLUNTEER,
      profile: { homeDistrict: 'Colombo' },
    },
    { name: 'Suresh Bandara', email: 'rescue.lead@example.test', role: Role.RESCUE_TEAM_LEAD },
    { name: 'Ruwan Jayasinghe', email: 'dmc.officer@example.test', role: Role.DMC_OFFICER },
    {
      name: 'Kasun Silva',
      email: 'duty.officer@example.test',
      role: Role.DUTY_OFFICER,
      profile: { shiftDistrict: 'Colombo' },
    },
    {
      name: 'Dilani Wickramasinghe',
      email: 'district.officer@example.test',
      role: Role.DISTRICT_OFFICER,
      profile: { district: 'Gampaha' },
    },
  ];

  async run() {
    const passwordHash = await bcrypt.hash(PeopleSeeder.#PASSWORD, PeopleSeeder.#SALT_ROUNDS);
    const districtIds = await PeopleSeeder.#districtIdsByName();

    for (const { name, email, role, profile = {} } of PeopleSeeder.#USERS) {
      await User.findOneAndUpdate(
        { email },
        PeopleSeeder.#upsert({ name, email, role, passwordHash }, profile, districtIds),
        { upsert: true, returnDocument: 'after' },
      );
      console.log(`Seeded ${role}: ${email}`);
    }

    await PeopleSeeder.#seedSyntheticCitizens(passwordHash, districtIds);
  }

  // One bulk write rather than 500 round trips. They share the demo password,
  // though nobody is expected to sign in as one.
  static async #seedSyntheticCitizens(passwordHash, districtIds) {
    const citizens = SyntheticCitizenGenerator.generate();
    await User.bulkWrite(
      citizens.map(({ name, email, ...profile }) => ({
        updateOne: {
          filter: { email },
          update: PeopleSeeder.#upsert(
            { name, email, role: Role.CITIZEN, passwordHash },
            profile,
            districtIds,
          ),
          upsert: true,
        },
      })),
    );
    console.log(`Seeded ${citizens.length} synthetic citizens`);
  }

  // Every district the accounts above or the synthetic citizens live in, by
  // name. A missing one means DistrictSeeder hasn't run, so the seed stops
  // rather than saving people with no district.
  static async #districtIdsByName() {
    const names = new Set(SyntheticCitizenGenerator.districtNames());
    for (const { profile = {} } of PeopleSeeder.#USERS) {
      for (const field of ['homeDistrict', 'district', 'shiftDistrict']) {
        if (profile[field]) names.add(profile[field]);
      }
    }

    const districts = await District.find({ name: { $in: [...names] } });
    const idsByName = new Map(districts.map((district) => [district.name, district._id]));
    for (const name of names) {
      if (!idsByName.has(name)) {
        throw new Error(`District "${name}" is not seeded - run DistrictSeeder first`);
      }
    }
    return idsByName;
  }

  // Creates the account from `account` if it's missing, and sets the profile
  // either way, with each district name swapped for its id. An account with
  // no profile gets no $set, which MongoDB would refuse as empty.
  static #upsert(account, profile, idsByName) {
    const fields = { ...profile };
    for (const field of ['homeDistrict', 'district', 'shiftDistrict']) {
      if (fields[field]) fields[field] = idsByName.get(fields[field]);
    }
    return Object.keys(fields).length > 0
      ? { $setOnInsert: account, $set: fields }
      : { $setOnInsert: account };
  }
}
