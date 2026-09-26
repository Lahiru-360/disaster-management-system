import { EmailTemplate } from './EmailTemplate.js';

// Carries the link and the expiry window in its copy, and nothing else that
// identifies the account — the recipient address itself is the `to` field
// the email is sent with, not anything inside the body.
export class PasswordResetEmail extends EmailTemplate {
  #resetLink;
  #ttlMinutes;

  constructor({ resetLink, ttlMinutes }) {
    super();
    this.#resetLink = resetLink;
    this.#ttlMinutes = ttlMinutes;
  }

  get subject() {
    return 'Reset your Disaster Management System password';
  }

  get html() {
    return `<p>We received a request to reset your Disaster Management System password.</p><p><a href="${this.#resetLink}">Reset your password</a></p><p>The link works once and expires after ${this.#ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>`;
  }

  get text() {
    return `We received a request to reset your Disaster Management System password. Use this link to set a new one:\n${this.#resetLink}\n\nThe link works once and expires after ${this.#ttlMinutes} minutes. If you didn't request this, you can ignore this email.`;
  }
}
