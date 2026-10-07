import mongoose from 'mongoose';

const districtCapacityAlertSchema = new mongoose.Schema(
  {
    // One record per district, so a lookup or an upsert by district is atomic.
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
      unique: true,
    },
    // When the DMC was last told that no shelter in the district has space, or
    // null once space was available again (UC03 E2, DMS-148).
    lastCapacityAlertAt: {
      type: Date,
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

// Kept thin on purpose: the schema above is the whole model. Used only by
// CapacityAlertWindow; a small record the UC03 class diagram doesn't draw.
export class DistrictCapacityAlert extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(DistrictCapacityAlert, districtCapacityAlertSchema);
