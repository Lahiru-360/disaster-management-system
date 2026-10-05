import mongoose from 'mongoose';

// A named sequence, e.g. the one hazard report numbers (GR-####) come from.
// ReferenceNumberGenerator moves it on with a single atomic $inc, so two
// requests at the same moment never get the same number.
const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  // The last number handed out; 0 before the first.
  seq: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
});

// Kept thin on purpose: the schema above is the whole model.
export class Counter extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(Counter, counterSchema);
