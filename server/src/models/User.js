import mongoose from 'mongoose';
import { Role } from '../enums/Role.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Profile fields the Person classes rely on. All optional, so accounts
    // created before they existed (and by /api/auth/register) still load.
    phone: {
      type: String,
      trim: true,
    },
    // Where a citizen lives: who an alert for that district reaches (UC01).
    homeDistrict: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      index: true,
    },
    // The district a district officer is responsible for (UC03).
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
    },
    // The district a duty officer covers on shift: who a report is routed to (UC02).
    shiftDistrict: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.passwordHash;
        delete ret.isActive;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Kept thin on purpose: the schema above is the whole model, and what a user
// can do (register, log in, change password, ...) lives in AuthService. Every
// role is stored here, flat; the role hierarchy is the Person classes in
// domain/people, which PersonFactory.fromUser() maps a User onto.
export class User extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(User, userSchema);
