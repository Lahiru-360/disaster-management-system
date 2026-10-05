import { Province } from '../../src/enums/Province.js';
import { District } from '../../src/models/District.js';
import { RiverBasin } from '../../src/models/RiverBasin.js';

/**
 * The mini-geography seedAreas() creates: three Western-province districts
 * with the same centroids and boxes as scripts/DistrictSeeder.js, so a test
 * can assert distances and "which district is this point in" against known
 * numbers. Kelani spans Colombo and Gampaha; Kalutara is in no basin.
 */
export const AREAS = Object.freeze({
  colombo: {
    name: 'Colombo',
    province: Province.WESTERN,
    centroid: { lat: 6.9271, lng: 79.8612 },
    bounds: { minLat: 6.75, maxLat: 6.98, minLng: 79.83, maxLng: 80.22 },
  },
  gampaha: {
    name: 'Gampaha',
    province: Province.WESTERN,
    centroid: { lat: 7.0917, lng: 79.9999 },
    bounds: { minLat: 6.98, maxLat: 7.33, minLng: 79.82, maxLng: 80.26 },
  },
  kalutara: {
    name: 'Kalutara',
    province: Province.WESTERN,
    centroid: { lat: 6.5854, lng: 79.9607 },
    bounds: { minLat: 6.27, maxLat: 6.76, minLng: 79.88, maxLng: 80.35 },
  },
});

/**
 * Seeds the districts in AREAS plus the Kelani basin. Call it in a test or a
 * beforeEach: tests/setup.js empties every collection after each test.
 *
 * @returns {Promise<{ colombo: District, gampaha: District, kalutara: District, kelani: RiverBasin }>}
 *   The saved documents, keyed as in AREAS.
 */
export const seedAreas = async () => {
  const colombo = await District.create(AREAS.colombo);
  const gampaha = await District.create(AREAS.gampaha);
  const kalutara = await District.create(AREAS.kalutara);
  const kelani = await RiverBasin.create({
    name: 'Kelani',
    districts: [colombo._id, gampaha._id],
  });

  return { colombo, gampaha, kalutara, kelani };
};
