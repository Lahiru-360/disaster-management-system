import { jest } from '@jest/globals';
import { DistrictSeeder } from '../../scripts/DistrictSeeder.js';
import { Province } from '../../src/enums/Province.js';
import { District } from '../../src/models/District.js';
import { RiverBasin } from '../../src/models/RiverBasin.js';
import { areaRegistry } from '../../src/services/AreaRegistry.js';
import { GeoDistance } from '../../src/utils/GeoDistance.js';

// The seeder's own data is what every demo runs on, so these check the data
// itself: the right districts and basins, and boxes that put real places in
// the right district.

beforeAll(async () => {
  await District.init();
  await RiverBasin.init();
});

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await new DistrictSeeder().run();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const idsByName = async (Model) =>
  Object.fromEntries((await Model.find()).map((doc) => [doc.name, String(doc._id)]));

describe('DistrictSeeder', () => {
  it('DMS-104: seeds the 25 districts across all 9 provinces', async () => {
    const districts = await District.find().lean();

    expect(districts).toHaveLength(25);
    expect(new Set(districts.map((district) => district.province))).toEqual(
      new Set(Object.values(Province)),
    );
  });

  it('DMS-104: seeds the five named basins and three more, each spanning known districts', async () => {
    const basins = await RiverBasin.find().populate('districts').lean();
    const spans = Object.fromEntries(
      basins.map((basin) => [basin.name, basin.districts.map((district) => district.name).sort()]),
    );

    expect(Object.keys(spans).sort()).toEqual([
      'Deduru Oya',
      'Gin',
      'Kalu',
      'Kelani',
      'Maha Oya',
      'Mahaweli',
      'Nilwala',
      'Walawe',
    ]);
    expect(spans.Kelani).toEqual(['Colombo', 'Gampaha', 'Kegalle', 'Nuwara Eliya', 'Ratnapura']);
    expect(spans.Nilwala).toEqual(['Matara']);
  });

  it('DMS-104: is idempotent - a second run keeps the same records and ids', async () => {
    const districtsBefore = await idsByName(District);
    const basinsBefore = await idsByName(RiverBasin);

    await new DistrictSeeder().run();

    expect(await idsByName(District)).toEqual(districtsBefore);
    expect(await idsByName(RiverBasin)).toEqual(basinsBefore);
  });

  it('DMS-104: restores a coordinate edited since the last seed', async () => {
    await District.updateOne({ name: 'Colombo' }, { $set: { 'centroid.lat': 1 } });

    await new DistrictSeeder().run();

    expect((await District.findOne({ name: 'Colombo' })).centroid.lat).toBe(6.9271);
  });

  it('DMS-104: measures about 23 km between the seeded Colombo and Gampaha', async () => {
    const colombo = await District.findOne({ name: 'Colombo' });
    const gampaha = await District.findOne({ name: 'Gampaha' });

    const km = GeoDistance.haversineMetres(colombo.centroid, gampaha.centroid) / 1000;

    expect(Math.abs(km - 23)).toBeLessThanOrEqual(1);
  });

  it("DMS-104: puts every district's capital inside its own box and back in that district", async () => {
    const misplaced = [];
    for (const district of await District.find().lean()) {
      const found = await areaRegistry.findDistrictForPoint(
        district.centroid.lat,
        district.centroid.lng,
      );
      if (
        GeoDistance.metresOutsideBox(district.centroid, district.bounds) !== 0 ||
        found?.name !== district.name
      ) {
        misplaced.push(`${district.name} -> ${found?.name}`);
      }
    }

    expect(misplaced).toEqual([]);
  });

  it.each([
    ['Moratuwa', 6.773, 79.8816, 'Colombo'],
    ['Horana', 6.7157, 80.0626, 'Kalutara'],
    ['Panadura', 6.7132, 79.9044, 'Kalutara'],
    ['Negombo', 7.2083, 79.8358, 'Gampaha'],
    ['Hatton', 6.8916, 80.5955, 'Nuwara Eliya'],
    ['Kitulgala', 6.9906, 80.418, 'Kegalle'],
    ['Embilipitiya', 6.3439, 80.8499, 'Ratnapura'],
    ['Wellawaya', 6.7358, 81.1027, 'Monaragala'],
    ['Kataragama', 6.4135, 81.3346, 'Monaragala'],
    ['Tissamaharama', 6.2786, 81.287, 'Hambantota'],
    ['Haputale', 6.768, 80.958, 'Badulla'],
    ['Dambulla', 7.8742, 80.6511, 'Matale'],
    ['Chilaw', 7.5758, 79.7953, 'Puttalam'],
    ['Kalmunai', 7.4167, 81.8167, 'Ampara'],
    ['Point Pedro', 9.8167, 80.2333, 'Jaffna'],
  ])('DMS-104: places %s in its district', async (_town, lat, lng, district) => {
    expect((await areaRegistry.findDistrictForPoint(lat, lng))?.name).toBe(district);
  });

  it.each([
    ['open sea south of the island', 5.0, 80.0],
    ['Chennai, India', 13.08, 80.27],
  ])('DMS-104: places a point in %s in no district', async (_place, lat, lng) => {
    expect(await areaRegistry.findDistrictForPoint(lat, lng)).toBeNull();
  });
});
