import mongoose from 'mongoose';
import { ShareStatus } from '../enums/ShareStatus.js';

// The class diagram's ReportShare: one report file sent to one Organisation's
// contact (UC04 step 15). Every share is kept, even to an organisation and
// email already shared with, as a record of who received the report.
const reportShareSchema = new mongoose.Schema(
  {
    // The report the export belongs to, kept here so a report's shares can be
    // listed without going through its exports.
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostEventReport',
      required: true,
    },
    // The export whose file was sent.
    export: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportExport',
      required: true,
    },
    // The organisation the report was sent to.
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      maxlength: 254,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // The DMC officer who shared it.
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ShareStatus),
      required: true,
      default: ShareStatus.SENT,
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

// A report's shares, newest first: what the report view lists (§14.10).
reportShareSchema.index({ report: 1, sharedAt: -1 });

// Kept thin on purpose: the schema above is the whole model. ShareService
// sends and records shares.
export class ReportShare extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(ReportShare, reportShareSchema);
