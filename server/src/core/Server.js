import { env } from '../config/Config.js';
import { database as defaultDatabase } from '../config/Database.js';
import { app as defaultApp } from './App.js';

// Runs the API as a process: installs the shutdown hooks, connects to the
// database, and only then starts accepting HTTP requests.
export class Server {
  #app;
  #database;
  #port;

  constructor({ app = defaultApp, database = defaultDatabase, port = env.port } = {}) {
    this.#app = app;
    this.#database = database;
    this.#port = port;
  }

  async start() {
    this.#database.registerShutdownHooks();
    await this.#database.connect();

    this.#app.listen(this.#port, () => {
      console.log(`Server listening on port ${this.#port}`);
    });
  }
}
