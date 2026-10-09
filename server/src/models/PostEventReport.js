import mongoose from 'mongoose';
import { AlertHazardType } from '../enums/AlertHazardType.js';
import { ReportSectionKey } from '../enums/ReportSectionKey.js';
import { SriLankaCalendar } from '../utils/SriLankaCalendar.js';

// A report covers whole Sri Lanka calendar days, stored as "YYYY-MM-DD" so a
// day never shifts with the server's time zone.
const day = {
  type: String,
  validate: {
    validator: (value) => value === null || SriLankaCalendar.isDay(value),
    message: 'must be a calendar day as YYYY-MM-DD',
  },
};

// The class diagram's DataGap: a run of days in one section with no records at
// all, flagged as incomplete data instead of being left out.
const dataGapSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      enum: Object.values(ReportSectionKey),
      required: true,
    },
    from: { ...day, required: true },
    to: {
      ...day,
      required: true,
      validate: [
        day.validate,
        {
          validator(value) {
            return !SriLankaCalendar.isDay(this.from) || value >= this.from;
          },
          message: 'must not be before from',
        },
      ],
    },
    // e.g. "No occupancy records".
    reason: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

// One compiled section. Each ReportSection strategy shapes its own result.
const sectionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: Object.values(ReportSectionKey),
      required: true,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false },
);

// The figures at the top of the report view. A figure whose section wasn't
// requested stays null.
const count = { type: Number, min: 0, default: null };
const summarySchema = new mongoose.Schema(
  {
    alertsIssued: count,
    citizensReached: count,
    citizensTargeted: count,
    // citizensReached / citizensTargeted, unrounded.
    reachedRate: { type: Number, min: 0, max: 1, default: null },
    peakOccupancy: count,
    peakOccupancyDate: { ...day, default: null },
    itemsDistributed: count,
  },
  { _id: false },
);

// The A1 filters a report was compiled with (DMS-156); all null otherwise.
const filtersSchema = new mongoose.Schema(
  {
    hazardType: {
      type: String,
      enum: [...Object.values(AlertHazardType), null],
      default: null,
    },
    districtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      default: null,
    },
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      default: null,
    },
  },
  { _id: false },
);

const postEventReportSchema = new mongoose.Schema(
  {
    // The CLOSED hazard event the report is about.
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HazardEvent',
      required: true,
    },
    // The DMC officer who generated it.
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
    },
    // The inclusive range of Sri Lanka calendar days the report covers.
    dateFrom: { ...day, required: true },
    dateTo: { ...day, required: true },
    districts: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'District' }],
      validate: {
        validator: (districts) => districts.length > 0,
        message: 'must list at least one district',
      },
    },
    filters: {
      type: filtersSchema,
      default: () => ({}),
    },
    summary: {
      type: summarySchema,
      default: () => ({}),
    },
    sections: {
      type: [sectionSchema],
      validate: [
        {
          validator: (sections) => sections.length > 0,
          message: 'must hold at least one section',
        },
        {
          validator: (sections) => new Set(sections.map((s) => s.key)).size === sections.length,
          message: 'must not repeat a section',
        },
      ],
    },
    gaps: {
      type: [dataGapSchema],
      default: [],
    },
  },
  {
    // A report is never edited once generated, so it has no updatedAt.
    timestamps: { createdAt: true, updatedAt: false },
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

postEventReportSchema.pre('validate', function () {
  if (SriLankaCalendar.isDay(this.dateFrom) && SriLankaCalendar.isDay(this.dateTo)) {
    if (this.dateFrom > this.dateTo) {
      this.invalidate('dateFrom', 'must not be after dateTo');
    }
  }
});

// Recent reports for an event, newest first (A3).
postEventReportSchema.index({ event: 1, generatedAt: -1 });

// Kept thin on purpose: the schema above is the whole model. Adding sections
// and asking about gaps is the PostEventReport class in domain/analysis.
export class PostEventReport extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(PostEventReport, postEventReportSchema);
