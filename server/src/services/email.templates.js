// Message bodies are rendered here, beside email.service.js, never assembled
// inline by callers. A template is a function that takes its own render data
// and returns an already-rendered `{ subject, html, text }` object — exactly
// the shape sendEmail() expects — so sendEmail() itself never has to know
// what kind of message it is sending.

// Carries the link and the expiry window in its copy, and nothing else that
// identifies the account — the recipient address itself is the `to` field
// sendEmail() is called with, not anything inside the body.
export const passwordResetEmail = ({ resetLink, ttlMinutes }) => ({
  subject: 'Reset your Disaster Management System password',
  html: `<p>We received a request to reset your Disaster Management System password.</p><p><a href="${resetLink}">Reset your password</a></p><p>The link works once and expires after ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.</p>`,
  text: `We received a request to reset your Disaster Management System password. Use this link to set a new one:\n${resetLink}\n\nThe link works once and expires after ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.`,
});
