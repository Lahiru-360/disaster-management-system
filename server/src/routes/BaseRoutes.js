import { Router } from 'express';

// Abstract base for a group of routes mounted together under one path.
// Subclasses pass their mount path to the constructor and declare their
// endpoints in registerRoutes(). The Router is built on first access to
// `router` rather than in this constructor, so registerRoutes() only ever
// runs on a fully constructed subclass.
export class BaseRoutes {
  #basePath;
  #router;

  constructor(basePath) {
    this.#basePath = basePath;
  }

  get basePath() {
    return this.#basePath;
  }

  get router() {
    if (!this.#router) {
      this.#router = Router();
      this.registerRoutes(this.#router);
    }
    return this.#router;
  }

  registerRoutes(_router) {
    throw new Error(`${this.constructor.name} must implement registerRoutes()`);
  }
}
