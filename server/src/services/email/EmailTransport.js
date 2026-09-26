// Abstract base for the ways an email can be delivered. EmailService holds one
// transport and calls send() without knowing which it is, so the provider stays
// swappable. send() receives an already-rendered { to, subject, html, text }.
export class EmailTransport {
  send(_message) {
    throw new Error(`${this.constructor.name} must implement send()`);
  }
}
