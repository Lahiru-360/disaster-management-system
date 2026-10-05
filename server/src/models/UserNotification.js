import mongoose from 'mongoose';
import { NotificationType } from '../enums/NotificationType.js';
import { SeverityLevel } from '../enums/SeverityLevel.js';

const userNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // A client route to open when the item is tapped, e.g. /my-reports/<id>.
    link: {
      type: String,
      trim: true,
      default: null,
    },
    // Only a hazard alert carries one: the app colours its card by it.
    severity: {
      type: String,
      enum: [...Object.values(SeverityLevel), null],
      default: null,
    },
    // null means unread.
    readAt: {
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
        delete ret.user;
        delete ret.updatedAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// A hazard alert must say how severe it is, and nothing else may: severity is
// what tells the app to draw an alert card. Checked on whole documents only;
// marking an item read never touches either path.
userNotificationSchema.pre('validate', function () {
  const isAlert = this.type === NotificationType.HAZARD_ALERT;
  if (isAlert && this.severity === null) {
    this.invalidate('severity', 'is required for a HAZARD_ALERT');
  }
  if (!isAlert && this.severity !== null) {
    this.invalidate('severity', 'is only allowed for a HAZARD_ALERT');
  }
});

// The inbox is read newest first, a page at a time, and the bell counts the
// unread ones on every poll.
userNotificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
userNotificationSchema.index({ user: 1, readAt: 1 });

// Kept thin on purpose: the schema above is the whole model. Sending one, and
// who may read or mark it, lives in NotificationService. Not named Notification:
// that is UC01's per-citizen, per-channel delivery record for a hazard warning.
export class UserNotification extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(UserNotification, userNotificationSchema);
