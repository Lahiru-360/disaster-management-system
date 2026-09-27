import { BrevoClient } from '@getbrevo/brevo';
import { ApiError } from '../../utils/ApiError.js';
import { EmailTransport } from './EmailTransport.js';

// The only module that may import the provider SDK — everything else sends
// through EmailService, so the provider stays swappable behind EmailTransport.
export class BrevoEmailTransport extends EmailTransport {
  #apiKey;
  #senderEmail;
  #client;

  constructor({ apiKey, senderEmail }) {
    super();
    this.#apiKey = apiKey;
    this.#senderEmail = senderEmail;
  }

  async send({ to, subject, html, text }) {
    try {
      await this.#getClient().transactionalEmails.sendTransacEmail({
        sender: { email: this.#senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      });
    } catch (error) {
      console.error('Email provider request failed:', error.message);
      throw BrevoEmailTransport.#unavailableError();
    }
  }

  // Constructed lazily, on first real send, rather than up front: the SDK
  // itself throws when it can find no API key at all, and the server must
  // stay startable with none of the EMAIL_* vars set (the no-op default).
  #getClient() {
    if (!this.#client) {
      this.#client = new BrevoClient({ apiKey: this.#apiKey });
    }
    return this.#client;
  }

  // A provider outage or bad key must never reach the client as an unhandled
  // rejection or a bare 500 — matches the shape StorageService uses for
  // 502 STORAGE_UNAVAILABLE. The underlying error is deliberately not attached
  // here: it may carry details of the message that shouldn't surface.
  static #unavailableError() {
    return new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.');
  }
}
