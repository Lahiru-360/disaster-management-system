import { AsyncHandler } from '../utils/AsyncHandler.js';

// Base for every controller. Express calls a route handler as a plain function,
// so a method handed over as `authController.login` would otherwise lose
// `this`. The constructor re-binds every method a subclass defines to the
// instance and wraps it so a rejected promise reaches the error handler.
//
// Every public method is therefore treated as a route handler; a helper a
// controller needs internally must be a #private method, which is left alone.
export class BaseController {
  constructor() {
    for (
      let prototype = Object.getPrototypeOf(this);
      prototype !== BaseController.prototype;
      prototype = Object.getPrototypeOf(prototype)
    ) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const { value } = Object.getOwnPropertyDescriptor(prototype, name);

        // Skip the constructor, getters, and methods a more-derived class
        // already overrode (handled on an earlier pass of the outer loop).
        if (name === 'constructor' || typeof value !== 'function' || Object.hasOwn(this, name)) {
          continue;
        }

        this[name] = AsyncHandler.wrap(value.bind(this));
      }
    }
  }
}
