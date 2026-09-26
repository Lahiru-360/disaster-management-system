import mongoose from 'mongoose';
import { ExpiringToken } from './ExpiringToken.js';

const passwordResetTokenSchema = new mongoose.Schema({
  user: ExpiringToken.ownerField(),
  tokenHash: {
    type: String,
    required: true,
  },
  expiresAt: ExpiringToken.expiryField(),
  usedAt: {
    type: Date,
    default: null,
  },
});

export class PasswordResetToken extends ExpiringToken {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(PasswordResetToken, passwordResetTokenSchema);
