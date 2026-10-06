import mongoose from 'mongoose';
import { TeamStatus } from '../enums/TeamStatus.js';

const location = {
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  label: { type: String, trim: true, default: null },
};

const rescueTeamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // An Organisation owns the team (UC03 class diagram).
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
    memberCount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'must be a whole number' },
    },
    // The rescue_team_lead who answers the team's dispatches in the field
    // app. Optional: a team can be on record before its lead has an account.
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    baseLocation: location,
    // Distances to an incident are measured from here. Starts at the base and
    // moves to the incident location when the team goes on site.
    currentLocation: location,
    status: {
      type: String,
      enum: Object.values(TeamStatus),
      required: true,
      default: TeamStatus.AVAILABLE,
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

// The natural key the seeder upserts by.
rescueTeamSchema.index({ district: 1, name: 1 }, { unique: true });
// "Available teams in this district" (UC03 step 7).
rescueTeamSchema.index({ district: 1, status: 1 });
rescueTeamSchema.index({ organisation: 1 });
// A lead leads at most one team, so "my assignments" has one answer.
rescueTeamSchema.index(
  { lead: 1 },
  { unique: true, partialFilterExpression: { lead: { $type: 'objectId' } } },
);

// Kept thin on purpose: the schema above is the whole model. Whether a team
// can be dispatched is the RescueTeam class in domain/coordination.
export class RescueTeam extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(RescueTeam, rescueTeamSchema);
