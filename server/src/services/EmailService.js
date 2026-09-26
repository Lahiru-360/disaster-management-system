import { env } from '../config/Config.js';
import { BrevoEmailTransport } from './email/BrevoEmailTransport.js';
import { NoopEmailTransport } from './email/NoopEmailTransport.js';

// The one way the rest of the server sends email. Which transport delivers it
// is chosen once, from EMAIL_TRANSPORT, when the shared instance is created.
export class EmailService {
  #transport;

  constructor(transport) {
    this.#transport = transport;
  }

  static fromConfig(config = env) {
    if (config.emailTransport === 'brevo') {
      return new EmailService(
        new BrevoEmailTransport({ apiKey: config.brevoApiKey, senderEmail: config.emailFrom }),
      );
    }
    return new EmailService(new NoopEmailTransport());
  }

  // Exposed so tests can read what the no-op transport recorded.
  get transport() {
    return this.#transport;
  }

  async send({ to, subject, html, text }) {
    await this.#transport.send({ to, subject, html, text });
  }
}

export const emailService = EmailService.fromConfig();
