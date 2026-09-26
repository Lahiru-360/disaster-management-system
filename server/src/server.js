import app from './app.js';
import { env } from './config/Config.js';
import { database } from './config/Database.js';

database.registerShutdownHooks();
await database.connect();

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
