import mongoose from 'mongoose';
import { OrgType } from '../enums/OrgType.js';

const organisationSchema = new mongoose.Schema(
  {
    // The natural key the seeder upserts by, e.g. "Red Cross Sri Lanka".
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: Object.values(OrgType),
      required: true,
    },
    // Where UC04 can email a shared report; null for an organisation that
    // isn't a report recipient.
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be an email address'],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Kept thin on purpose: the schema above is the whole model. Organisations
// are reference data - UC03's stock and teams and UC04's report shares point
// at them.
export class Organisation extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(Organisation, organisationSchema);
