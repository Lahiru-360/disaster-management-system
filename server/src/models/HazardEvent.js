import mongoose from 'mongoose';
import { AlertHazardType } from '../enums/AlertHazardType.js';
import { EventStatus } from '../enums/EventStatus.js';

const hazardEventSchema = new mongoose.Schema(
  {
    // The natural key the seeder upserts by, e.g. "Kelani basin floods".
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // UC01's list: an event groups the alerts issued for it, so it uses theirs.
    hazardType: {
      type: String,
      enum: Object.values(AlertHazardType),
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    // null while the event is ACTIVE.
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      required: true,
    },
    // The districts the event affects: at least one.
    districts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'District' }],
      validate: {
        validator: (districts) => districts.length > 0,
        message: 'must list at least one district',
      },
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

// An ACTIVE event has not ended and a CLOSED one has, after it started.
// Checked on whole documents, so the seeder saves documents rather than
// updating them in place.
hazardEventSchema.pre('validate', function () {
  const isActive = this.status === EventStatus.ACTIVE;
  if (isActive && this.endDate !== null) {
    this.invalidate('endDate', 'must be null while the event is ACTIVE');
  }
  if (this.status === EventStatus.CLOSED && this.endDate === null) {
    this.invalidate('endDate', 'is required once the event is CLOSED');
  }
  if (this.endDate !== null && this.startDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'must not be before startDate');
  }
});

// UC03 looks up the ACTIVE event for a district; UC04 lists CLOSED events,
// most recent first.
hazardEventSchema.index({ status: 1, startDate: -1 });
hazardEventSchema.index({ districts: 1 });

// Kept thin on purpose: the schema above is the whole model. What an event
// means (isClosed, covers) is the HazardEvent class in domain/events.
export class HazardEvent extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(HazardEvent, hazardEventSchema);
