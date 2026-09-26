import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/Config.js';
import { User } from '../src/models/User.js';

const SEED_PASSWORD = 'Password123!';

// One account per role. Admin accounts can only be created here or by direct
// database access - public registration rejects role: "admin".
const seedUsers = [
  { email: 'seeker@example.test', role: 'seeker' },
  { email: 'business@example.test', role: 'business' },
  { email: 'admin@example.test', role: 'admin' },
];

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const { email, role } of seedUsers) {
    await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, role, passwordHash } },
      { upsert: true, returnDocument: 'after' },
    );
    console.log(`Seeded ${role}: ${email}`);
  }

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
