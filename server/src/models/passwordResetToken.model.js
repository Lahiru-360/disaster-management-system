import crypto from 'crypto';
import mongoose from 'mongoose';

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

export const hashPasswordResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const passwordResetTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
  usedAt: {
    type: Date,
    default: null,
  },
});

export const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
