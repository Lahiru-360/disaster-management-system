import { Place as PlaceModel } from '../models/Place.js';

// Place-name search over the seeded gazetteer (UC02 A2.2, contract §9.8).
export class PlaceService {
  static MAX_RESULTS = 10;

  #placeModel;

  constructor({ placeModel = PlaceModel } = {}) {
    this.#placeModel = placeModel;
  }

  /**
   * Places whose name starts with `q`, case-insensitively, sorted by name, at
   * most 10, each with its district's { id, name }.
   * @param {string} q Already validated: 2-50 characters.
   * @returns {Promise<object[]>}
   */
  async search(q) {
    const prefix = new RegExp(`^${PlaceService.#escapeRegExp(q.trim())}`, 'i');
    const places = await this.#placeModel
      .find({ name: prefix })
      .sort({ name: 1, _id: 1 })
      .limit(PlaceService.MAX_RESULTS)
      .populate({ path: 'district', select: 'name' });

    return places.map((place) => {
      const json = place.toJSON();
      json.district = { id: place.district.id, name: place.district.name };
      return json;
    });
  }

  // The query is a name, not a pattern: "St. (Mary)" must match literally.
  static #escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const placeService = new PlaceService();
