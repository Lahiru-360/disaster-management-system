import { isInsideSriLanka } from '../constants/geo';
import { DESCRIPTION_MAX_LENGTH } from '../constants/hazardReports';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 100;

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

export function validateSignUpForm({ name, email, password, confirmPassword }) {
  const errors = {};

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    errors.name = 'Enter your full name.';
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

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

// UC02 E1 on the device: the server's submit rules (docs/api-contract.md
// §9.2), checked before sending so most mistakes show at once. Keys are the
// form's fields - `photo` for the server's photoUrl - and each message says
// what to do.
export function validateHazardReport({ photo, description, hazardType, location }) {
  const errors = {};

  if (!photo) {
    errors.photo = 'Take a photo of the hazard.';
  } else {
    const fileError = validateImageFile(photo);
    if (fileError) errors.photo = fileError;
  }

  if (!location) {
    errors.location = 'Your location is needed. Try again, or move to an open area.';
  } else if (!isInsideSriLanka(location)) {
    errors.location = 'This location is outside Sri Lanka.';
  }

  const text = (description || '').trim();
  if (!text) {
    errors.description = 'Describe what you see.';
  } else if (text.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep it to ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (!hazardType) {
    errors.hazardType = 'Choose a hazard type.';
  }

  return errors;
}

// The server's 400 VALIDATION_ERROR entries (one per top-level request field)
// as form errors, so a server-side rejection outlines the same fields.
const SERVER_FIELD_TO_FORM_FIELD = {
  photoUrl: 'photo',
  location: 'location',
  locationSource: 'location',
  description: 'description',
  hazardType: 'hazardType',
};

export function hazardReportErrorsFromServer(serverErrors = []) {
  const errors = {};
  for (const { field, message } of serverErrors) {
    const formField = SERVER_FIELD_TO_FORM_FIELD[field];
    if (formField && !errors[formField]) {
      errors[formField] = message.charAt(0).toUpperCase() + message.slice(1) + '.';
    }
  }
  return errors;
}
