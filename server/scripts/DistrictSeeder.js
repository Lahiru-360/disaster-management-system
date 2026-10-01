import { Province } from '../src/enums/Province.js';
import { District } from '../src/models/District.js';
import { RiverBasin } from '../src/models/RiverBasin.js';

// Seeds the registered geography: the 25 districts of Sri Lanka, then the
// river basins that span them. Safe to re-run: each district and basin is
// matched by name and updated in place ($set), so a corrected coordinate
// reaches the database on the next seed and nothing is ever duplicated.
// Expects an open connection - DatabaseSeeder owns it.
export class DistrictSeeder {
  // centroid is the district capital's coordinates: the point the district's
  // name refers to, and the reference for distances. bounds is a hand-set
  // bounding box around the district - an approximation, so neighbouring boxes
  // may overlap; AreaRegistry settles a point in two boxes by nearest centroid.
  static #DISTRICTS = [
    district('Colombo', Province.WESTERN, [6.9271, 79.8612], [6.75, 6.98, 79.83, 80.22]),
    district('Gampaha', Province.WESTERN, [7.0917, 79.9999], [6.98, 7.33, 79.82, 80.26]),
    district('Kalutara', Province.WESTERN, [6.5854, 79.9607], [6.27, 6.76, 79.88, 80.35]),
    district('Kandy', Province.CENTRAL, [7.2906, 80.6337], [6.97, 7.52, 80.43, 80.98]),
    district('Matale', Province.CENTRAL, [7.4675, 80.6234], [7.37, 7.98, 80.45, 80.98]),
    district('Nuwara Eliya', Province.CENTRAL, [6.9497, 80.7891], [6.72, 7.2, 80.45, 80.95]),
    district('Galle', Province.SOUTHERN, [6.0535, 80.221], [5.98, 6.43, 80.03, 80.5]),
    district('Matara', Province.SOUTHERN, [5.9549, 80.555], [5.91, 6.33, 80.4, 80.75]),
    district('Hambantota', Province.SOUTHERN, [6.1241, 81.1185], [6.0, 6.33, 80.7, 81.6]),
    district('Jaffna', Province.NORTHERN, [9.6615, 80.0255], [9.36, 9.83, 79.68, 80.35]),
    district('Kilinochchi', Province.NORTHERN, [9.3803, 80.377], [9.15, 9.6, 80.1, 80.6]),
    district('Mannar', Province.NORTHERN, [8.981, 79.9044], [8.5, 9.1, 79.7, 80.25]),
    district('Vavuniya', Province.NORTHERN, [8.7514, 80.4971], [8.55, 9.05, 80.2, 80.7]),
    district('Mullaitivu', Province.NORTHERN, [9.2671, 80.8142], [8.8, 9.45, 80.4, 80.95]),
    district('Batticaloa', Province.EASTERN, [7.731, 81.6747], [7.35, 8.2, 81.25, 81.9]),
    district('Ampara', Province.EASTERN, [7.2912, 81.6724], [6.6, 7.6, 81.3, 81.9]),
    district('Trincomalee', Province.EASTERN, [8.5874, 81.2152], [8.0, 9.0, 80.8, 81.45]),
    district('Kurunegala', Province.NORTH_WESTERN, [7.4863, 80.3623], [7.2, 8.05, 79.95, 80.6]),
    district('Puttalam', Province.NORTH_WESTERN, [8.0362, 79.8283], [7.35, 8.55, 79.68, 80.15]),
    district('Anuradhapura', Province.NORTH_CENTRAL, [8.3114, 80.4037], [7.85, 8.8, 80.05, 81.0]),
    district('Polonnaruwa', Province.NORTH_CENTRAL, [7.9403, 81.0188], [7.65, 8.35, 80.75, 81.4]),
    district('Badulla', Province.UVA, [6.9934, 81.055], [6.75, 7.6, 80.85, 81.35]),
    district('Monaragala', Province.UVA, [6.8728, 81.3507], [6.35, 7.25, 81.0, 81.7]),
    district('Ratnapura', Province.SABARAGAMUWA, [6.6828, 80.3992], [6.2, 6.95, 80.15, 80.95]),
    district('Kegalle', Province.SABARAGAMUWA, [7.2513, 80.3464], [6.9, 7.35, 80.1, 80.55]),
  ];

  // The five basins the design names, plus three more that flood often, each
  // with the districts it spans by name.
  static #RIVER_BASINS = [
    { name: 'Kelani', districts: ['Colombo', 'Gampaha', 'Kegalle', 'Ratnapura', 'Nuwara Eliya'] },
    { name: 'Kalu', districts: ['Ratnapura', 'Kalutara'] },
    { name: 'Gin', districts: ['Galle', 'Matara'] },
    { name: 'Nilwala', districts: ['Matara'] },
    {
      name: 'Mahaweli',
      districts: ['Nuwara Eliya', 'Kandy', 'Matale', 'Badulla', 'Polonnaruwa', 'Trincomalee'],
    },
    { name: 'Walawe', districts: ['Ratnapura', 'Hambantota', 'Monaragala'] },
    { name: 'Deduru Oya', districts: ['Kurunegala', 'Puttalam'] },
    { name: 'Maha Oya', districts: ['Kegalle', 'Kurunegala', 'Gampaha', 'Puttalam'] },
  ];

  async run() {
    const idsByName = new Map();

    for (const { name, ...fields } of DistrictSeeder.#DISTRICTS) {
      const doc = await District.findOneAndUpdate(
        { name },
        { $set: { name, ...fields } },
        { upsert: true, runValidators: true, returnDocument: 'after' },
      );
      idsByName.set(name, doc._id);
    }
    console.log(`Seeded ${DistrictSeeder.#DISTRICTS.length} districts`);

    for (const { name, districts } of DistrictSeeder.#RIVER_BASINS) {
      await RiverBasin.findOneAndUpdate(
        { name },
        {
          $set: {
            name,
            districts: districts.map((district) => DistrictSeeder.#idOf(idsByName, district)),
          },
        },
        { upsert: true, runValidators: true },
      );
    }
    console.log(`Seeded ${DistrictSeeder.#RIVER_BASINS.length} river basins`);
  }

  // A basin naming a district that isn't in the list above is a typo here, so
  // it stops the seed rather than saving a basin that spans nothing.
  static #idOf(idsByName, districtName) {
    const id = idsByName.get(districtName);
    if (!id) {
      throw new Error(`River basin names unknown district "${districtName}"`);
    }
    return id;
  }
}

// Keeps the table above one row per district: [lat, lng] and
// [minLat, maxLat, minLng, maxLng] in decimal degrees.
function district(name, province, [lat, lng], [minLat, maxLat, minLng, maxLng]) {
  return { name, province, centroid: { lat, lng }, bounds: { minLat, maxLat, minLng, maxLng } };
}
