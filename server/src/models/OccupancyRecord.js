import mongoose from 'mongoose';

const wholeNumber = { validator: Number.isInteger, message: 'must be a whole number' };

const occupancyRecordSchema = new mongoose.Schema(
  {
    // A Shelter owns its occupancy history (UC03 class diagram).
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      required: true,
    },
    // Copied from the shelter so post-event reports (UC04) can query a
    // district's occupancy over time without a join.
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    occupants: {
      type: Number,
      required: true,
      min: 0,
      validate: wholeNumber,
    },
    // The shelter's capacity at the time, so the rate can be recomputed later.
    capacity: {
      type: Number,
      required: true,
      min: 1,
      validate: wholeNumber,
    },
    // Set by the service from its clock, not defaulted here, so tests control it.
    recordedAt: {
      type: Date,
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    // A record is written once and never changed: recordedAt is its time.
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

// One shelter's history in order, and a district's for UC04's reports.
occupancyRecordSchema.index({ shelter: 1, recordedAt: 1 });
occupancyRecordSchema.index({ district: 1, recordedAt: 1 });

// Kept thin on purpose: the schema above is the whole model. Records are
// created by ShelterService when an occupancy update succeeds.
export class OccupancyRecord extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(OccupancyRecord, occupancyRecordSchema);
