import mongoose from 'mongoose';
import { SupplyType } from '../enums/SupplyType.js';

const reliefStockSchema = new mongoose.Schema(
  {
    // An Organisation owns its stock (UC03 class diagram).
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organisation',
      required: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    supplyType: {
      type: String,
      enum: Object.values(SupplyType),
      required: true,
    },
    // What a quantity is counted in, e.g. "bottles".
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    // Never negative: a distribution reduces it only when enough remains.
    quantityAvailable: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'must be a whole number' },
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

// One row per organisation, district and supply type: the natural key the
// seeder upserts by, and the Log Relief Supply dialog's lookup.
reliefStockSchema.index({ organisation: 1, district: 1, supplyType: 1 }, { unique: true });
reliefStockSchema.index({ district: 1, supplyType: 1 });

// Kept thin on purpose: the schema above is the whole model. Withdrawal rules
// are the ReliefStock class in domain/coordination.
export class ReliefStock extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(ReliefStock, reliefStockSchema);
