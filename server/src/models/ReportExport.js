import mongoose from 'mongoose';
import { ExportFormat } from '../enums/ExportFormat.js';

// The class diagram's ReportExport: one file a post-event report was exported
// to (UC04 step 13). Every export is kept, even of a format exported before,
// as an audit trail; nothing is stored when the file can't be made (E3).
const reportExportSchema = new mongoose.Schema(
  {
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PostEventReport',
      required: true,
    },
    format: {
      type: String,
      enum: Object.values(ExportFormat),
      required: true,
    },
    // Where the uploaded file can be downloaded.
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // The DMC officer who exported it.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    // An export is never edited, so it has no updatedAt.
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

// A report's exports, newest first: what sharing (DMS-155) looks for.
reportExportSchema.index({ report: 1, format: 1, createdAt: -1 });

// Kept thin on purpose: the schema above is the whole model. ExportService
// writes, uploads and records exports.
export class ReportExport extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(ReportExport, reportExportSchema);
