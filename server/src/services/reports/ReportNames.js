import { District as DistrictModel } from '../../models/District.js';
import { Organisation as OrganisationModel } from '../../models/Organisation.js';

// Names the districts and organisations a report section groups by, so its
// result carries { id, name } references (§13.2) and a client never needs a
// second request to show them.
export class ReportNames {
  #districtModel;
  #organisationModel;

  constructor({ districtModel = DistrictModel, organisationModel = OrganisationModel } = {}) {
    this.#districtModel = districtModel;
    this.#organisationModel = organisationModel;
  }

  /**
   * `{ id, name }` for each district id. An id with no district gets a null name.
   * @param {string[]} ids
   * @returns {Promise<Map<string, { id: string, name: string|null }>>}
   */
  async districts(ids) {
    const docs = await this.#findByIds(this.#districtModel, ids, 'name');
    return ReportNames.#byId(ids, docs, (doc) => ({ name: doc?.name ?? null }));
  }

  /**
   * `{ id, name, type }` for each organisation id. An id with no organisation
   * gets a null name and type.
   * @param {string[]} ids
   * @returns {Promise<Map<string, { id: string, name: string|null, type: string|null }>>}
   */
  async organisations(ids) {
    const docs = await this.#findByIds(this.#organisationModel, ids, 'name type');
    return ReportNames.#byId(ids, docs, (doc) => ({
      name: doc?.name ?? null,
      type: doc?.type ?? null,
    }));
  }

  #findByIds(model, ids, fields) {
    const unique = [...new Set(ids.map(String))];
    return unique.length === 0 ? [] : model.find({ _id: { $in: unique } }, fields).lean();
  }

  static #byId(ids, docs, fieldsOf) {
    const found = new Map(docs.map((doc) => [String(doc._id), doc]));
    return new Map(ids.map(String).map((id) => [id, { id, ...fieldsOf(found.get(id)) }]));
  }
}
