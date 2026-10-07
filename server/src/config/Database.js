import mongoose from 'mongoose';
import { env } from './Config.js';

// Owns the process's Mongoose connection: opening it on startup and closing
// it cleanly when the process is told to stop.
export class Database {
  #uri;

  constructor(uri = env.mongoUri) {
    this.#uri = uri;
  }

  async connect() {
    try {
      await mongoose.connect(this.#uri);
      console.log('MongoDB connected');
    } catch (err) {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    }
  }

  /**
   * Closes the connection and exits on SIGINT or SIGTERM.
   * @param {() => void|Promise<void>} [beforeClose] Run first, e.g. to stop background jobs.
   */
  registerShutdownHooks(beforeClose) {
    process.on('SIGINT', () => this.#shutdown('SIGINT', beforeClose));
    process.on('SIGTERM', () => this.#shutdown('SIGTERM', beforeClose));
  }

  async #shutdown(signal, beforeClose) {
    await beforeClose?.();
    console.log(`${signal} received, closing MongoDB connection`);
    await mongoose.connection.close();
    process.exit(0);
  }
}

export const database = new Database();
