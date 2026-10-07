import { env } from '../config/Config.js';
import { database as defaultDatabase } from '../config/Database.js';
import { dispatchTimeoutJob as defaultDispatchTimeoutJob } from '../jobs/DispatchTimeoutJob.js';
import { app as defaultApp } from './App.js';

// Runs the API as a process: installs the shutdown hooks, connects to the
// database, starts the background jobs, and only then starts accepting HTTP
// requests. The jobs stop first when the process is told to stop.
export class Server {
  #app;
  #database;
  #port;
  #dispatchTimeoutJob;

  constructor({
    app = defaultApp,
    database = defaultDatabase,
    port = env.port,
    dispatchTimeoutJob = defaultDispatchTimeoutJob,
  } = {}) {
    this.#app = app;
    this.#database = database;
    this.#port = port;
    this.#dispatchTimeoutJob = dispatchTimeoutJob;
  }

  async start() {
    this.#database.registerShutdownHooks(() => this.#dispatchTimeoutJob.stop());
    await this.#database.connect();
    this.#dispatchTimeoutJob.start();

    this.#app.listen(this.#port, () => {
      console.log(`Server listening on port ${this.#port}`);
    });
  }
}
