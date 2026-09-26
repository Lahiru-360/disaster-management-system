import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/Config.js';
import { User } from '../src/models/User.js';

// Seeds one dev/test account per role. Safe to re-run: accounts are matched by
// email and only created when missing ($setOnInsert), so an existing one is
// never duplicated or overwritten.
export class DatabaseSeeder {
  static #PASSWORD = 'Password123!';

  static #SALT_ROUNDS = 10;

  // One account per role. Admin accounts can only be created here or by direct
  // database access - public registration rejects role: "admin".
  static #USERS = [
    { email: 'seeker@example.test', role: 'seeker' },
    { email: 'business@example.test', role: 'business' },
    { email: 'admin@example.test', role: 'admin' },
  ];

  async run() {
    await mongoose.connect(env.mongoUri);

    const passwordHash = await bcrypt.hash(DatabaseSeeder.#PASSWORD, DatabaseSeeder.#SALT_ROUNDS);

    for (const { email, role } of DatabaseSeeder.#USERS) {
      await User.findOneAndUpdate(
        { email },
        { $setOnInsert: { email, role, passwordHash } },
        { upsert: true, returnDocument: 'after' },
      );
      console.log(`Seeded ${role}: ${email}`);
    }

    await mongoose.connection.close();
  }
}
