import mongoose from 'mongoose';
import { DispatchStatus } from '../enums/DispatchStatus.js';
import { Priority } from '../enums/Priority.js';

const statusEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(DispatchStatus),
      required: true,
    },
    at: {
      type: Date,
      required: true,
    },
    // The user who made the change; null when the server did (a timeout).
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false },
);

const dispatchSchema = new mongoose.Schema(
  {
    // The RescueTeam the dispatch is assigned to (UC03 class diagram).
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RescueTeam',
      required: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    // The district's ACTIVE hazard event when the dispatch was created.
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HazardEvent',
      required: true,
    },
    incidentLocation: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
      label: { type: String, trim: true, default: null },
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DispatchStatus),
      required: true,
      default: DispatchStatus.ASSIGNED,
    },
    // The DistrictOfficer who creates it (UC03 class diagram).
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Set by the service from its clock rather than by Mongoose timestamps,
    // so tests control it - the acknowledgement deadline is counted from it.
    createdAt: {
      type: Date,
      required: true,
    },
    ackDeadline: {
      type: Date,
      default: null,
    },
    declineReason: {
      type: String,
      trim: true,
      default: null,
    },
    statusHistory: {
      type: [statusEntrySchema],
      default: [],
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
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

// A team's open dispatch (its "current task"), a district's dispatches newest
// first, and the overdue ASSIGNED ones the timeout check looks for.
dispatchSchema.index({ team: 1, status: 1 });
dispatchSchema.index({ district: 1, createdAt: -1 });
dispatchSchema.index({ status: 1, ackDeadline: 1 });

// Kept thin on purpose: the schema above is the whole model. Which status may
// follow which is the Dispatch class in domain/coordination.
export class Dispatch extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(Dispatch, dispatchSchema);
