import mongoose from 'mongoose';
import { Province } from '../enums/Province.js';

const latitude = { type: Number, required: true, min: -90, max: 90 };
const longitude = { type: Number, required: true, min: -180, max: 180 };

const districtSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    province: {
      type: String,
      enum: Object.values(Province),
      required: true,
    },
    // The reference point for distances between districts and to a location.
    centroid: {
      lat: latitude,
      lng: longitude,
    },
    // A bounding box, not the real outline: an accepted approximation, used
    // only to work out which district a point falls in.
    bounds: {
      minLat: latitude,
      maxLat: latitude,
      minLng: longitude,
      maxLng: longitude,
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

// Reads another path's value inside a validator. On save `this` is the document;
// under update validators (runValidators, e.g. a seeder's upsert) it is the
// Query, so the value comes from the update being applied instead. A path the
// update doesn't set is undefined, and the check is skipped for it.
function siblingValue(context, path) {
  if (context instanceof mongoose.Query) {
    const update = context.getUpdate() ?? {};
    const fields = update.$set ?? update;
    return fields[path] ?? path.split('.').reduce((value, key) => value?.[key], fields);
  }
  return context.get(path);
}

// A box with its edges swapped would contain no point at all, so it is refused
// here rather than silently never matching.
districtSchema.path('bounds.maxLat').validate(function (maxLat) {
  const minLat = siblingValue(this, 'bounds.minLat');
  return minLat === undefined || minLat <= maxLat;
}, 'must not be less than bounds.minLat');

districtSchema.path('bounds.maxLng').validate(function (maxLng) {
  const minLng = siblingValue(this, 'bounds.minLng');
  return minLng === undefined || minLng <= maxLng;
}, 'must not be less than bounds.minLng');

// Kept thin on purpose: the schema above is the whole model. What a district
// covers (contains) is the District class in domain/areas, which AreaRegistry
// maps a document onto.
export class District extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(District, districtSchema);
