const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email) {
  return EMAIL_RE.test((email || '').trim());
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

// Presentational only - the server rule is length, full stop, so this never
// feeds back into isValidPassword or any request body. Labels say what to
// do, not just what's wrong, and the three levels match the three bars
// PasswordStrengthMeter draws: 1 filled = weak, 2 = medium, 3 = strong.
export function getPasswordStrength(password) {
  const value = password || '';
  if (!value) return null;

  if (value.length < MIN_PASSWORD_LENGTH) {
    return {
      level: 'weak',
      filledBars: 1,
      label: `Weak — use at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  const hasNumberOrSymbol = /[0-9]/.test(value) || /[^A-Za-z0-9]/.test(value);
  if (!hasNumberOrSymbol) {
    return { level: 'medium', filledBars: 2, label: 'Medium — add a number or symbol' };
  }

  return { level: 'strong', filledBars: 3, label: 'Strong password' };
}

export function validateSignUpForm({ email, password, confirmPassword }) {
  const errors = {};

  if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!isValidPassword(password)) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

// Mirrors docs/api-contract.md §6.1's own upload rules, so an oversize or
// wrong-type file is caught before it costs a round trip to POST /api/uploads.
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];

export function validateImageFile({ fileSize, mimeType }) {
  if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    return 'Photo must be a PNG or JPG file.';
  }

  if (typeof fileSize === 'number' && fileSize > MAX_IMAGE_FILE_SIZE) {
    return 'Photo must be 5MB or smaller.';
  }

  return null;
}
