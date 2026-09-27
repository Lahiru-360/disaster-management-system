import mongoose from 'mongoose';
import { ExpiringToken } from './ExpiringToken.js';

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
  },
  user: ExpiringToken.ownerField(),
  expiresAt: ExpiringToken.expiryField(),
});

export class RefreshToken extends ExpiringToken {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(RefreshToken, refreshTokenSchema);
