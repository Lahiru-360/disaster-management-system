import mongoose from 'mongoose';
import { DismissalReason } from '../enums/DismissalReason.js';
import { LocationSource } from '../enums/LocationSource.js';
import { ReportHazardType } from '../enums/ReportHazardType.js';
import { ReportStatus } from '../enums/ReportStatus.js';

// A GeoJSON Point, so the duplicate check (DMS-135) can use $near on the
// 2dsphere index. GeoJSON puts longitude first: coordinates = [lng, lat].
const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: ([lng, lat, ...rest]) =>
          rest.length === 0 &&
          Number.isFinite(lng) &&
          Number.isFinite(lat) &&
          lng >= -180 &&
          lng <= 180 &&
          lat >= -90 &&
          lat <= 90,
        message: 'must be [longitude, latitude] on the globe',
      },
    },
  },
  { _id: false },
);

const hazardReportSchema = new mongoose.Schema(
  {
    // GR-#### from ReferenceNumberGenerator: what the reporter and the officer
    // see. The class diagram's reportId.
    referenceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    photoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    hazardType: {
      type: String,
      enum: Object.values(ReportHazardType),
      required: true,
    },
    location: {
      type: pointSchema,
      required: true,
    },
    locationSource: {
      type: String,
      enum: Object.values(LocationSource),
      required: true,
    },
    // The district the location falls in, or the reporter's home district
    // when it falls in none. Decides which duty officer reviews it.
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
    },
    // Set by the service from its injected clock, so there is no default here.
    submittedAt: {
      type: Date,
      required: true,
    },
    // The duty officer who confirmed or dismissed it (0..1 in the class diagram).
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    dismissalReason: {
      type: String,
      enum: [...Object.values(DismissalReason), null],
      default: null,
    },
    dismissalNote: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    // Reports of the same situation share one; a report that matched no
    // earlier one starts its own cluster, with its own _id.
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // The UUID the app generated, so an offline report sent twice (A3) is
    // stored once. No default: a sparse unique index skips a missing field
    // but not a null one.
    clientReportId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
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
        // The contract's { latitude, longitude }, not GeoJSON's [lng, lat].
        if (ret.location?.coordinates) {
          const [longitude, latitude] = ret.location.coordinates;
          ret.location = { latitude, longitude };
        }
        ret.clientReportId ??= null;
        return ret;
      },
    },
  },
);

hazardReportSchema.index({ location: '2dsphere' });
// The duty officer's queue: PENDING reports in one district, newest first.
hazardReportSchema.index({ status: 1, district: 1, submittedAt: -1 });

// Kept thin on purpose: the schema above is the whole model. What a report may
// do (confirm, dismiss, be escalated) is the HazardReport class in
// domain/reports.
export class HazardReport extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(HazardReport, hazardReportSchema);
