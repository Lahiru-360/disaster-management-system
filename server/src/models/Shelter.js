import mongoose from 'mongoose';

const wholeNumber = { validator: Number.isInteger, message: 'must be a whole number' };

const shelterSchema = new mongoose.Schema(
  {
    // A District hosts its shelters (UC03 class diagram).
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
      // An address or description, e.g. "Gampaha town".
      label: { type: String, trim: true, default: null },
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      validate: wholeNumber,
    },
    // May exceed capacity: nobody is turned away, the shelter is just FULL.
    currentOccupancy: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: wholeNumber,
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

// The natural key, and the dashboard's "shelters in this district" lookup. The
// collation (strength 2) compares names ignoring case, so "Ja-Ela Central
// College" and "ja-ela central college" are one name; the schema's `trim`
// removes surrounding spaces. This is the contract's SHELTER_NAME_TAKEN rule
// (§13.4.3), enforced by the database so concurrent registrations can't both
// succeed. Named explicitly so it sits beside a deployed case-sensitive
// `district_1_name_1` index rather than clashing with it.
shelterSchema.index(
  { district: 1, name: 1 },
  { unique: true, name: 'district_1_name_1_ci', collation: { locale: 'en', strength: 2 } },
);

// Kept thin on purpose: the schema above is the whole model. The occupancy
// rate and status rules are the Shelter class in domain/coordination.
export class Shelter extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(Shelter, shelterSchema);
