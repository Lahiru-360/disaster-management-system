import mongoose from 'mongoose';

const riverBasinSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // A basin spans one or more districts, which a single name on the District
    // could not express.
    districts: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'District',
        },
      ],
      validate: [
        {
          validator: (districts) => districts.length > 0,
          message: 'must contain at least one district',
        },
        {
          validator: (districts) =>
            new Set(districts.map((id) => id.toString())).size === districts.length,
          message: 'must not contain the same district twice',
        },
      ],
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

// Kept thin on purpose: the schema above is the whole model. What a basin
// covers (contains) is the RiverBasin class in domain/areas, which AreaRegistry
// maps a document onto.
export class RiverBasin extends mongoose.Model {}

// Registered through the connection: given a class, Mongoose 9's mongoose.model() keys
// it by the class's source text instead of its name, which breaks lookups like ref: 'User'.
mongoose.connection.model(RiverBasin, riverBasinSchema);
