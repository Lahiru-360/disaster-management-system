import { DatabaseSeeder } from './DatabaseSeeder.js';

new DatabaseSeeder().run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
