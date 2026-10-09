import { District } from '../domain/areas/District.js';
import { RiverBasin } from '../domain/areas/RiverBasin.js';
import { District as DistrictModel } from '../models/District.js';
import { RiverBasin as RiverBasinModel } from '../models/RiverBasin.js';
import { GeoDistance } from '../utils/GeoDistance.js';

// The registered geography: looks up districts and river basins by id, turns
// their documents into TargetArea objects, and answers "which district is this
// point in". Every feature that works "by district" asks this service, so
// alerts, reports, shelters and post-event reports agree on geography.
export class AreaRegistry {
  // A point further than this from every district's box is outside Sri Lanka
  // (e.g. well offshore), not in the nearest district.
  static #MAX_METRES_OUTSIDE_BOXES = 50000;

  static #OBJECT_ID = /^[0-9a-f]{24}$/i;

  #districtModel;
  #riverBasinModel;

  constructor({ districtModel = DistrictModel, riverBasinModel = RiverBasinModel } = {}) {
    this.#districtModel = districtModel;
    this.#riverBasinModel = riverBasinModel;
  }

  /**
   * Every district, sorted by name - for GET /api/districts. Documents, not
   * District objects: the model's toJSON is what shapes the response.
   */
  listDistricts() {
    return this.#districtModel.find().sort({ name: 1 });
  }

  /**
   * Every river basin, sorted by name, each with the { id, name } of the
   * districts it spans, also sorted by name - for GET /api/river-basins.
   */
  listRiverBasins() {
    return this.#riverBasinModel
      .find()
      .sort({ name: 1 })
      .populate({ path: 'districts', select: 'name', options: { sort: { name: 1 } } });
  }

  /**
   * Resolves target-area ids, each a District or a RiverBasin. An id that is
   * malformed or matches neither is returned in unknownIds rather than thrown,
   * so the caller can name every bad id in one validation error. Both lists
   * keep the order the ids were given in, without repeats.
   * @param {string[]} ids
   * @returns {Promise<{ areas: import('../domain/areas/TargetArea.js').TargetArea[], unknownIds: string[] }>}
   */
  async validateAreas(ids = []) {
    // Hex ids are compared lower-case, the form the database hands them back in.
    const requested = [
      ...new Set(
        ids.map((id) => {
          const text = String(id);
          return AreaRegistry.#OBJECT_ID.test(text) ? text.toLowerCase() : text;
        }),
      ),
    ];
    const wellFormed = requested.filter((id) => AreaRegistry.#OBJECT_ID.test(id));

    const [districtDocs, basinDocs] =
      wellFormed.length === 0
        ? [[], []]
        : await Promise.all([
            this.#districtModel.find({ _id: { $in: wellFormed } }).lean(),
            this.#riverBasinModel
              .find({ _id: { $in: wellFormed } })
              .populate('districts')
              .lean(),
          ]);

    const found = new Map([
      ...districtDocs.map((doc) => [String(doc._id), this.#toDistrict(doc)]),
      ...basinDocs.map((doc) => [String(doc._id), this.#toRiverBasin(doc)]),
    ]);

    return {
      areas: requested.filter((id) => found.has(id)).map((id) => found.get(id)),
      unknownIds: requested.filter((id) => !found.has(id)),
    };
  }

  /**
   * The ids of every district the areas cover: a District itself, and each
   * district a RiverBasin spans. Without repeats, in first-seen order.
   * @param {import('../domain/areas/TargetArea.js').TargetArea[]} areas
   * @returns {string[]}
   */
  expandToDistricts(areas) {
    const districts = areas.flatMap((area) =>
      area instanceof RiverBasin ? area.districts : [area],
    );
    return [...new Set(districts.map((district) => district.areaId))];
  }

  /**
   * The reverse of expandToDistricts: the ids of every area that covers at
   * least one of the districts - the districts themselves and each river basin
   * spanning any of them. An alert targeting any of these overlaps the
   * districts, so this is what an overlap query matches stored targets against.
   * @param {string[]} districtIds
   * @returns {Promise<string[]>}
   */
  async areaIdsCovering(districtIds) {
    if (districtIds.length === 0) return [];
    const basins = await this.#riverBasinModel
      .find({ districts: { $in: districtIds } })
      .select('_id')
      .lean();
    return [...new Set([...districtIds.map(String), ...basins.map(({ _id }) => String(_id))])];
  }

  /**
   * The district a point falls in, or null when it is more than 50 km from
   * every district. Bounding boxes are only an approximation, so a point in
   * several boxes (or on a shared edge) goes to the nearest centroid among
   * them, and a point just outside every box (e.g. on the coast) goes to the
   * nearest centroid overall.
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<District|null>}
   */
  async findDistrictForPoint(lat, lng) {
    const point = { lat, lng };
    const districts = (await this.#districtModel.find().lean())
      .map((doc) => this.#toDistrict(doc))
      .filter((district) => district.bounds && district.centroid);

    const containing = districts.filter(
      (district) => GeoDistance.metresOutsideBox(point, district.bounds) === 0,
    );
    if (containing.length > 0) {
      return AreaRegistry.#nearestCentroid(point, containing);
    }

    const nearby = districts.filter(
      (district) =>
        GeoDistance.metresOutsideBox(point, district.bounds) <=
        AreaRegistry.#MAX_METRES_OUTSIDE_BOXES,
    );
    return nearby.length > 0 ? AreaRegistry.#nearestCentroid(point, districts) : null;
  }

  // Ties go to the alphabetically first name, so the answer never depends on
  // the order the database returned the districts in.
  static #nearestCentroid(point, districts) {
    const ranked = districts
      .map((district) => ({
        district,
        metres: GeoDistance.haversineMetres(point, district.centroid),
      }))
      .sort((a, b) => a.metres - b.metres || a.district.name.localeCompare(b.district.name));
    return ranked[0].district;
  }

  #toDistrict(doc) {
    return new District({
      areaId: doc._id,
      name: doc.name,
      province: doc.province,
      centroid: doc.centroid,
      bounds: doc.bounds,
    });
  }

  #toRiverBasin(doc) {
    return new RiverBasin({
      areaId: doc._id,
      name: doc.name,
      districts: doc.districts.map((district) => this.#toDistrict(district)),
    });
  }
}

export const areaRegistry = new AreaRegistry();
