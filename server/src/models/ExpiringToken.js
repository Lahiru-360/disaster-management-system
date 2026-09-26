import mongoose from 'mongoose';

// Abstract base for the token collections (RefreshToken, PasswordResetToken).
// It is never compiled into a model of its own; it supplies the two fields
// every token shares, which each subclass places in its own schema.
export class ExpiringToken extends mongoose.Model {
  // The account the token was issued to.
  static ownerField() {
    return {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    };
  }

  // A TTL index with `expires: 0` lets MongoDB delete the document as soon as
  // expiresAt passes, so expired tokens never have to be cleaned up by hand.
  static expiryField() {
    return {
      type: Date,
      required: true,
      expires: 0,
    };
  }
}
