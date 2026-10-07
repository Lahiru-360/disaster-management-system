import mongoose from 'mongoose';

const shelterRedirectSchema = new mongoose.Schema(
  {
    // The shelter whose new arrivals are sent away.
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      required: true,
    },
    // The shelter that takes them.
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      required: true,
    },
    // Both shelters are in it; copied so a district's redirects need no join.
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    // The district officer who redirected.
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Set by the service from its clock, not defaulted here, so tests control it.
    at: {
      type: Date,
      required: true,
    },
  },
  {
    // A record is written once and never changed: `at` is its time.
    timestamps: false,
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

// A shelter's redirects, newest first being the current one.
shelterRedirectSchema.index({ from: 1, at: 1 });

// Kept thin on purpose: the schema above is the whole model. A small record the
// UC03 class diagram doesn't draw (UC03 A2.3 needs the redirect remembered);
// it is created by ShelterService and justified in the deviation log.
export class ShelterRedirect extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(ShelterRedirect, shelterRedirectSchema);
