import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/Config.js';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { ApiError } from '../utils/ApiError.js';
import { emailService as defaultEmailService } from './EmailService.js';
import { PasswordResetEmail } from './email/PasswordResetEmail.js';
import { tokenService as defaultTokenService } from './TokenService.js';

// Account lifecycle: registration, sign-in, session refresh and logout,
// password change and reset, and deactivation.
export class AuthService {
  static #SALT_ROUNDS = 10;

  static #RESET_TOKEN_TTL_MINUTES = 30;

  // Only this hash is stored; the raw token exists only in the emailed link.
  static hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  #tokenService;
  #emailService;

  constructor({ tokenService = defaultTokenService, emailService = defaultEmailService } = {}) {
    this.#tokenService = tokenService;
    this.#emailService = emailService;
  }

  async register({ name, email, password, role }) {
    const passwordHash = await bcrypt.hash(password, AuthService.#SALT_ROUNDS);

    let user;
    try {
      user = await User.create({ name, email, passwordHash, role });
    } catch (err) {
      if (err.code === 11000) {
        throw new ApiError(
          409,
          'EMAIL_ALREADY_EXISTS',
          'An account with this email already exists.',
        );
      }
      throw err;
    }

    const { accessToken, refreshToken } = await this.#tokenService.issueTokens(user);

    return { user, accessToken, refreshToken };
  }

  refreshTokens(refreshToken) {
    return this.#tokenService.rotateRefreshToken(refreshToken);
  }

  logout(refreshToken) {
    return this.#tokenService.revokeRefreshToken(refreshToken);
  }

  async login({ email, password }) {
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

    const { accessToken, refreshToken } = await this.#tokenService.issueTokens(user);

    return { user, accessToken, refreshToken };
  }

  async changePassword(user, { currentPassword, newPassword }) {
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

    user.passwordHash = await bcrypt.hash(newPassword, AuthService.#SALT_ROUNDS);
    await user.save();

    await this.#tokenService.revokeAllRefreshTokens(user._id);

    return this.#tokenService.issueTokens(user);
  }

  // Always returns nothing distinguishable to the caller: the controller sends
  // the same 200 body regardless of whether an account was found, is active,
  // or an email went out. The account-exists branch below does strictly more
  // work (a token write plus a provider call) than the no-op branch, so this
  // is a deliberately accepted timing difference rather than a constant-time
  // implementation — there is no rate-limiting layer in this project to pair
  // a stricter mitigation with, and the branch itself cannot be removed
  // without skipping the reset-email send entirely.
  async requestPasswordReset({ email }) {
    const user = await User.findOne({ email });

    if (!user || user.isActive === false) {
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = AuthService.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + AuthService.#RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    // Only the most recent link should ever work, so any earlier unused token
    // for this account is invalidated before the new one is issued.
    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({ user: user._id, tokenHash, expiresAt });

    const resetLink = `${env.passwordResetUrlBase}?token=${rawToken}`;
    const message = new PasswordResetEmail({
      resetLink,
      ttlMinutes: AuthService.#RESET_TOKEN_TTL_MINUTES,
    });

    await this.#emailService.send({ to: user.email, ...message.render() });
  }

  async resetPassword({ token, newPassword }) {
    const tokenHash = AuthService.hashResetToken(token);
    const resetToken = await PasswordResetToken.findOne({ tokenHash });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
      throw AuthService.#resetTokenInvalid();
    }

    const user = await User.findById(resetToken.user);

    if (!user) {
      throw AuthService.#resetTokenInvalid();
    }

    user.passwordHash = await bcrypt.hash(newPassword, AuthService.#SALT_ROUNDS);
    await user.save();

    resetToken.usedAt = new Date();
    await resetToken.save();

    // The person resetting isn't signed in anywhere, unlike change-password,
    // so there is no acting session to preserve — every refresh token dies.
    await this.#tokenService.revokeAllRefreshTokens(user._id);
  }

  async deactivateAccount(user) {
    user.isActive = false;
    await user.save();

    await this.#tokenService.revokeAllRefreshTokens(user._id);
  }

  // An expired, already-used, unknown or malformed token must be
  // indistinguishable to the caller, so every failure path here throws the
  // same RESET_TOKEN_INVALID — never a reason why.
  static #resetTokenInvalid() {
    return new ApiError(
      400,
      'RESET_TOKEN_INVALID',
      'This reset link is invalid or has expired. Request a new one.',
    );
  }
}

export const authService = new AuthService();
