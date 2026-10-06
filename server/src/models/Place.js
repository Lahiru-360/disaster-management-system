import mongoose from 'mongoose';

const latitude = { type: Number, required: true, min: -90, max: 90 };
const longitude = { type: Number, required: true, min: -180, max: 180 };

// A town or village in the seeded gazetteer, for UC02 A2: a reporter with no
// GPS fix types a place name instead (GET /api/places). Mocked geocoding, as
// the FAQ allows - no external service is called.
const placeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    location: {
      latitude,
      longitude,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
      },
    },
  },
);

// The same name may exist in two districts; within one it is the natural key.
placeSchema.index({ name: 1, district: 1 }, { unique: true });

// Kept thin on purpose: the schema above is the whole model.
export class Place extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(Place, placeSchema);
