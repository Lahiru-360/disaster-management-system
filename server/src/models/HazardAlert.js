import mongoose from 'mongoose';
import { AlertHazardType } from '../enums/AlertHazardType.js';
import { AlertStatus } from '../enums/AlertStatus.js';
import { SeverityLevel } from '../enums/SeverityLevel.js';

// One area the warning is aimed at: a District or a RiverBasin (the class
// diagram's TargetArea), referenced through `kind` so either can be populated.
const targetSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['District', 'RiverBasin'],
      required: true,
    },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'targets.kind',
      required: true,
    },
  },
  { _id: false },
);

// One status change: what it became, at which version, when and by whom.
const historyEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(AlertStatus),
      required: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    at: {
      type: Date,
      required: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: false },
);

const hazardAlertSchema = new mongoose.Schema(
  {
    // HA-#### from ReferenceNumberGenerator: what officers see. The class
    // diagram's alertId.
    referenceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Type, severity, message and scope are empty on a new draft and filled in
    // by the preview, since the draft is created when composing starts.
    hazardType: {
      type: String,
      enum: [...Object.values(AlertHazardType), null],
      default: null,
    },
    severity: {
      type: String,
      enum: [...Object.values(SeverityLevel), null],
      default: null,
    },
    // At most 160 characters, so it fits in one SMS.
    message: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(AlertStatus),
      default: AlertStatus.DRAFT,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    targets: {
      type: [targetSchema],
      default: [],
    },
    // The ACTIVE hazard event covering the scope, so UC04 can group alerts by event.
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HazardEvent',
      default: null,
    },
    // The confirmed report it was escalated from (UC01 A1): "raised from" 0..1.
    sourceReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HazardReport',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Set on broadcast, from the service's injected clock.
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [historyEntrySchema],
      default: [],
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

// The active-warning check (A2) and the active list (A3) filter by status and type.
hazardAlertSchema.index({ status: 1, hazardType: 1 });
// Finding the alerts that target an area.
hazardAlertSchema.index({ 'targets.area': 1 });

// Kept thin on purpose: the schema above is the whole model. Which status
// changes are allowed is the HazardAlert class in domain/alerts.
export class HazardAlert extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(HazardAlert, hazardAlertSchema);
