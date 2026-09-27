// Wraps an async route handler or middleware so a rejected promise is passed
// to next() — and so to the error handler — instead of going unhandled.
export class AsyncHandler {
  static wrap(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}
