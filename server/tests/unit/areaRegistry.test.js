import mongoose from 'mongoose';
import { District } from '../../src/domain/areas/District.js';
import { RiverBasin } from '../../src/domain/areas/RiverBasin.js';
import { AreaRegistry } from '../../src/services/AreaRegistry.js';

// Stands in for a Mongoose model: supports the chained queries AreaRegistry
// makes (find by _id $in, or everything; populate / sort / lean) over a fixed
// list of plain documents, and records every filter it was asked for.
class FakeModel {
  constructor(docs) {
    this.docs = docs;
    this.filters = [];
  }

  find(filter = {}) {
    this.filters.push(filter);
    const ids = filter._id?.$in;
    const matched = ids ? this.docs.filter((doc) => ids.includes(String(doc._id))) : this.docs;
    const query = {
      populate: () => query,
      sort: () => query,
      lean: async () => matched,
    };
    return query;
  }
}

const hexId = () => new mongoose.Types.ObjectId().toString();

const colomboDoc = {
  _id: hexId(),
  name: 'Colombo',
  province: 'Western',
  centroid: { lat: 6.9271, lng: 79.8612 },
  bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
};
const gampahaDoc = {
  _id: hexId(),
  name: 'Gampaha',
  province: 'Western',
  centroid: { lat: 7.0917, lng: 79.9999 },
  bounds: { minLat: 6.98, maxLat: 7.33, minLng: 79.82, maxLng: 80.26 },
};
const kalutaraDoc = {
  _id: hexId(),
  name: 'Kalutara',
  province: 'Western',
  centroid: { lat: 6.5854, lng: 79.9607 },
  bounds: { minLat: 6.27, maxLat: 6.76, minLng: 79.88, maxLng: 80.35 },
};
// A basin as validateAreas loads it: districts already populated.
const kelaniDoc = { _id: hexId(), name: 'Kelani', districts: [colomboDoc, gampahaDoc] };

const buildRegistry = (
  districtDocs = [colomboDoc, gampahaDoc, kalutaraDoc],
  basinDocs = [kelaniDoc],
) => {
  const districtModel = new FakeModel(districtDocs);
  const riverBasinModel = new FakeModel(basinDocs);
  return {
    registry: new AreaRegistry({ districtModel, riverBasinModel }),
    districtModel,
    riverBasinModel,
  };
};

const ids = (areas) => areas.map((area) => area.areaId);

describe('AreaRegistry.validateAreas', () => {
  it('DMS-104: resolves a district id to a District with every field', async () => {
    const { registry } = buildRegistry();

    const { areas, unknownIds } = await registry.validateAreas([colomboDoc._id]);

    expect(unknownIds).toEqual([]);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toBeInstanceOf(District);
    expect(areas[0].areaId).toBe(colomboDoc._id);
    expect(areas[0].name).toBe('Colombo');
    expect(areas[0].province).toBe('Western');
    expect(areas[0].centroid).toEqual(colomboDoc.centroid);
    expect(areas[0].bounds).toEqual(colomboDoc.bounds);
  });

  it('DMS-104: resolves a basin id to a RiverBasin of District objects', async () => {
    const { registry } = buildRegistry();

    const { areas } = await registry.validateAreas([kelaniDoc._id]);

    expect(areas[0]).toBeInstanceOf(RiverBasin);
    expect(areas[0].name).toBe('Kelani');
    expect(ids(areas[0].districts)).toEqual([colomboDoc._id, gampahaDoc._id]);
    expect(areas[0].districts.every((district) => district instanceof District)).toBe(true);
    expect(areas[0].contains({ homeDistrict: gampahaDoc._id })).toBe(true);
  });

  it('DMS-104: reports a well-formed id that matches no area as unknown', async () => {
    const { registry } = buildRegistry();
    const missing = hexId();

    const { areas, unknownIds } = await registry.validateAreas([colomboDoc._id, missing]);

    expect(ids(areas)).toEqual([colomboDoc._id]);
    expect(unknownIds).toEqual([missing]);
  });

  it.each([
    ['a word', 'not-an-id'],
    ['a number', 42],
    ['a 12-character string Mongo would otherwise accept', 'aaaaaaaaaaaa'],
    ['23 hex characters', 'a'.repeat(23)],
  ])('DMS-104: reports %s as unknown without querying for it', async (_label, id) => {
    const { registry, districtModel, riverBasinModel } = buildRegistry();

    const { areas, unknownIds } = await registry.validateAreas([id]);

    expect(areas).toEqual([]);
    expect(unknownIds).toEqual([String(id)]);
    expect(districtModel.filters).toEqual([]);
    expect(riverBasinModel.filters).toEqual([]);
  });

  it('DMS-104: keeps the order the ids were given in, for both lists', async () => {
    const { registry } = buildRegistry();
    const missing = hexId();

    const { areas, unknownIds } = await registry.validateAreas([
      kelaniDoc._id,
      'bad',
      kalutaraDoc._id,
      missing,
      colomboDoc._id,
    ]);

    expect(ids(areas)).toEqual([kelaniDoc._id, kalutaraDoc._id, colomboDoc._id]);
    expect(unknownIds).toEqual(['bad', missing]);
  });

  it('DMS-104: drops repeated ids, including the same id in upper and lower case', async () => {
    const { registry } = buildRegistry();

    const { areas, unknownIds } = await registry.validateAreas([
      colomboDoc._id,
      colomboDoc._id.toUpperCase(),
      'bad',
      'bad',
    ]);

    expect(ids(areas)).toEqual([colomboDoc._id]);
    expect(unknownIds).toEqual(['bad']);
  });

  it('DMS-104: accepts an ObjectId as well as its hex string', async () => {
    const { registry } = buildRegistry();

    const { areas } = await registry.validateAreas([
      mongoose.Types.ObjectId.createFromHexString(colomboDoc._id),
    ]);

    expect(ids(areas)).toEqual([colomboDoc._id]);
  });

  it('DMS-104: returns two empty lists for no ids, leaving the empty-scope rule to the caller', async () => {
    const { registry, districtModel } = buildRegistry();

    await expect(registry.validateAreas([])).resolves.toEqual({ areas: [], unknownIds: [] });
    await expect(registry.validateAreas()).resolves.toEqual({ areas: [], unknownIds: [] });
    expect(districtModel.filters).toEqual([]);
  });
});

describe('AreaRegistry.expandToDistricts', () => {
  it('DMS-104: expands a basin to its districts and keeps a district as itself', async () => {
    const { registry } = buildRegistry();
    const { areas } = await registry.validateAreas([kelaniDoc._id, kalutaraDoc._id]);

    expect(registry.expandToDistricts(areas)).toEqual([
      colomboDoc._id,
      gampahaDoc._id,
      kalutaraDoc._id,
    ]);
  });

  it('DMS-104: counts a district once when a basin already covers it', async () => {
    const { registry } = buildRegistry();
    const { areas } = await registry.validateAreas([colomboDoc._id, kelaniDoc._id]);

    expect(registry.expandToDistricts(areas)).toEqual([colomboDoc._id, gampahaDoc._id]);
  });

  it('DMS-104: gives no districts for no areas', () => {
    const { registry } = buildRegistry();

    expect(registry.expandToDistricts([])).toEqual([]);
  });
});

describe('AreaRegistry.findDistrictForPoint', () => {
  const nameAt = async (registry, lat, lng) =>
    (await registry.findDistrictForPoint(lat, lng))?.name ?? null;

  it('DMS-104: finds the district whose box contains the point', async () => {
    const { registry } = buildRegistry();

    expect(await nameAt(registry, 6.9, 79.95)).toBe('Colombo');
    expect(await nameAt(registry, 7.2, 80.1)).toBe('Gampaha');
    expect(await registry.findDistrictForPoint(6.9, 79.95)).toBeInstanceOf(District);
  });

  it('DMS-104: settles a point on a shared box edge by the nearest centroid', async () => {
    const { registry } = buildRegistry();

    // 6.98 N is both Colombo's northern edge and Gampaha's southern one.
    expect(await nameAt(registry, 6.98, 79.87)).toBe('Colombo');
    expect(await nameAt(registry, 6.98, 80.0)).toBe('Gampaha');
  });

  it('DMS-104: settles a point in two overlapping boxes by the nearest centroid', async () => {
    const { registry } = buildRegistry();

    // Colombo (6.75-6.98) and Kalutara (6.27-6.76) overlap between 6.75 and
    // 6.76; there, Kalutara's centroid (~19 km) is nearer than Colombo's (~22 km).
    expect(await nameAt(registry, 6.755, 79.95)).toBe('Kalutara');
  });

  it('DMS-104: breaks an exact tie by name, whatever order the districts come in', async () => {
    const twin = (name) => ({ ...colomboDoc, _id: hexId(), name });
    const { registry } = buildRegistry([twin('Zeta'), twin('Alpha')]);

    expect(await nameAt(registry, 6.9, 79.95)).toBe('Alpha');
  });

  it('DMS-104: gives a point just off the coast to the nearest centroid', async () => {
    const { registry } = buildRegistry();

    // About 11 km west of Colombo's box, in the sea.
    expect(await nameAt(registry, 6.93, 79.73)).toBe('Colombo');
  });

  it('DMS-104: returns null for a point more than 50 km from every box', async () => {
    const { registry } = buildRegistry();

    expect(await registry.findDistrictForPoint(6.9, 79.2)).toBeNull();
    expect(await registry.findDistrictForPoint(13.08, 80.27)).toBeNull();
  });

  it('DMS-104: matches just inside the 50 km limit and refuses just beyond it', async () => {
    const equator = {
      _id: hexId(),
      name: 'Equator',
      centroid: { lat: 0, lng: 0.5 },
      bounds: { minLat: -1, maxLat: 1, minLng: 0, maxLng: 1 },
    };
    const { registry } = buildRegistry([equator]);
    const degreesEastOfBox = (km) => 1 + km / ((2 * Math.PI * 6371) / 360);

    expect(await nameAt(registry, 0, degreesEastOfBox(49.9))).toBe('Equator');
    expect(await nameAt(registry, 0, degreesEastOfBox(50.1))).toBeNull();
  });

  it('DMS-104: returns null when no districts are registered', async () => {
    const { registry } = buildRegistry([]);

    expect(await registry.findDistrictForPoint(6.9, 79.95)).toBeNull();
  });

  it('DMS-104: skips a district stored without a centroid or box', async () => {
    const { registry } = buildRegistry([{ _id: hexId(), name: 'Partial' }, colomboDoc]);

    expect(await nameAt(registry, 6.9, 79.95)).toBe('Colombo');
  });

  it('DMS-104: throws a TypeError for a non-numeric point', async () => {
    const { registry } = buildRegistry();

    await expect(registry.findDistrictForPoint(undefined, 79.95)).rejects.toThrow(TypeError);
    await expect(registry.findDistrictForPoint('6.9', 79.95)).rejects.toThrow(TypeError);
  });
});
