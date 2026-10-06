import mongoose from 'mongoose';
import { SupplyType } from '../enums/SupplyType.js';

const supplyDistributionSchema = new mongoose.Schema(
  {
    // A Shelter receives the distribution (UC03 class diagram).
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shelter',
      required: true,
    },
    // The ReliefStock it is drawn from.
    stock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReliefStock',
      required: true,
    },
    // organisation, supplyType and district are copied from the stock row so
    // post-event reports (UC04) can total distributions without a join.
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
    },
    supplyType: {
      type: String,
      enum: Object.values(SupplyType),
      required: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'must be a whole number' },
    },
    // Set by the service from its clock, not defaulted here, so tests control it.
    distributedAt: {
      type: Date,
      required: true,
    },
    // The DistrictOfficer who logs it (UC03 class diagram).
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    // A distribution is written once and never changed: distributedAt is its time.
    timestamps: false,
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

// A district's distributions in time order (the dashboard's recent logs and
// UC04's reports), and an organisation's totals.
supplyDistributionSchema.index({ district: 1, distributedAt: 1 });
supplyDistributionSchema.index({ organisation: 1 });

// Kept thin on purpose: the schema above is the whole model. Distributions
// are created by SupplyService once the stock withdrawal has succeeded.
export class SupplyDistribution extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(SupplyDistribution, supplyDistributionSchema);
