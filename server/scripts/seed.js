import { DatabaseSeeder } from './DatabaseSeeder.js';

// npm run seed [-- --only=uc03[,uc04]] [-- --reset-demo]
Promise.resolve()
  .then(() => new DatabaseSeeder().run(DatabaseSeeder.parseArgs(process.argv.slice(2))))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
