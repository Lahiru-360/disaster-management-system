import mongoose from 'mongoose';
import { Channel } from '../enums/Channel.js';
import { DeliveryStatus } from '../enums/DeliveryStatus.js';
import { NotificationKind } from '../enums/NotificationKind.js';

// UC01's delivery record (api-contract §12.9): one per recipient, channel and
// alert version. Clients never receive these; the delivery summary counts them
// and UC04 reads them for "citizens reached". Not the shared inbox item, which
// is UserNotification.
const notificationSchema = new mongoose.Schema(
  {
    alert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HazardAlert',
      required: true,
    },
    alertVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    kind: {
      type: String,
      enum: Object.values(NotificationKind),
      required: true,
    },
    citizen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: String,
      enum: Object.values(Channel),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DeliveryStatus),
      default: DeliveryStatus.QUEUED,
    },
    // Starts at 1; the SMS fallback (E3) retries up to 3 attempts in total.
    attempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
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

// A recipient gets each version of an alert once per channel, even if a
// broadcast is retried.
notificationSchema.index({ alert: 1, alertVersion: 1, citizen: 1, channel: 1 }, { unique: true });
// The delivery summary groups one alert's records by status.
notificationSchema.index({ alert: 1, status: 1 });

// Kept thin on purpose: the schema above is the whole model. How a delivery's
// status may change is the Notification class in domain/alerts.
export class Notification extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(Notification, notificationSchema);
