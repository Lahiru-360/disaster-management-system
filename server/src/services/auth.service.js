import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import {
  PasswordResetToken,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  hashPasswordResetToken,
} from '../models/passwordResetToken.model.js';
import { ApiError } from '../utils/ApiError.js';
import { sendEmail } from './email.service.js';
import { passwordResetEmail } from './email.templates.js';
import {
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from './token.service.js';

const SALT_ROUNDS = 10;

export const registerUser = async ({ email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await User.create({ email, passwordHash, role });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
    }
    throw err;
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { user, accessToken, refreshToken };
};

export const refreshTokens = (refreshToken) => rotateRefreshToken(refreshToken);

export const logoutUser = (refreshToken) => revokeRefreshToken(refreshToken);

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  // Distinguishable from a wrong password on purpose: the enumeration rule
  // above protects unknown accounts, but the caller here has already proven
  // they hold the right credentials, so they're the account's owner, not an
  // attacker probing for addresses.
  if (user.isActive === false) {
    throw new ApiError(403, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated.');
  }

  const { accessToken, refreshToken } = await issueTokens(user);

  return { user, accessToken, refreshToken };
};

export const changeUserPassword = async (user, { currentPassword, newPassword }) => {
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

  if (isSamePassword) {
    throw new ApiError(
      400,
      'PASSWORD_UNCHANGED',
      'New password must be different from your current password.',
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  await revokeAllRefreshTokensForUser(user._id);

  return issueTokens(user);
};

// Always returns nothing distinguishable to the caller: the controller sends
// the same 200 body regardless of whether an account was found, is active,
// or an email went out. The account-exists branch below does strictly more
// work (a token write plus a provider call) than the no-op branch, so this
// is a deliberately accepted timing difference rather than a constant-time
// implementation — there is no rate-limiting layer in this project to pair
// a stricter mitigation with, and the branch itself cannot be removed
// without skipping the reset-email send entirely.
export const requestPasswordReset = async ({ email }) => {
  const user = await User.findOne({ email });

  if (!user || user.isActive === false) {
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  // Only the most recent link should ever work, so any earlier unused token
  // for this account is invalidated before the new one is issued.
  await PasswordResetToken.deleteMany({ user: user._id });
  await PasswordResetToken.create({ user: user._id, tokenHash, expiresAt });

  const resetLink = `${env.passwordResetUrlBase}?token=${rawToken}`;

  await sendEmail({ to: user.email, ...passwordResetEmail({ resetLink }) });
};

// An expired, already-used, unknown or malformed token must be
// indistinguishable to the caller, so every failure path here throws the
// same RESET_TOKEN_INVALID — never a reason why.
const resetTokenInvalid = () =>
  new ApiError(
    400,
    'RESET_TOKEN_INVALID',
    'This reset link is invalid or has expired. Request a new one.',
  );

export const resetPassword = async ({ token, newPassword }) => {
  const tokenHash = hashPasswordResetToken(token);
  const resetToken = await PasswordResetToken.findOne({ tokenHash });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
    throw resetTokenInvalid();
  }

  const user = await User.findById(resetToken.user);

  if (!user) {
    throw resetTokenInvalid();
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  // The person resetting isn't signed in anywhere, unlike change-password,
  // so there is no acting session to preserve — every refresh token dies.
  await revokeAllRefreshTokensForUser(user._id);
};

export const deactivateOwnAccount = async (user) => {
  user.isActive = false;
  await user.save();

  await revokeAllRefreshTokensForUser(user._id);
};
