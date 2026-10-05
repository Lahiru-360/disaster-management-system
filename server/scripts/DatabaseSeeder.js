import mongoose from 'mongoose';
import { env } from '../src/config/Config.js';
import { DistrictSeeder } from './DistrictSeeder.js';
import { PeopleSeeder } from './PeopleSeeder.js';
import { Uc02Seeder } from './Uc02Seeder.js';

// Owns the connection and runs each domain seeder in order.
export class DatabaseSeeder {
  async run() {
    await mongoose.connect(env.mongoUri);

    await new DistrictSeeder().run();
    await new PeopleSeeder().run();
    await new Uc02Seeder().run();

    await mongoose.connection.close();
  }
}
