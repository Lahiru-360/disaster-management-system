import { EmailTransport } from './EmailTransport.js';

// The default transport: records the message and reports success without
// sending anything.
export class NoopEmailTransport extends EmailTransport {
  // Recorded here rather than returned from send(), so a test can assert an
  // email would have gone out — and what was in it — without a network call.
  #sentEmails = [];

  send({ to, subject, html, text }) {
    this.#sentEmails.push({ to, subject, html, text });
  }

  getSentEmails() {
    return this.#sentEmails;
  }

  clearSentEmails() {
    this.#sentEmails.length = 0;
  }
}
