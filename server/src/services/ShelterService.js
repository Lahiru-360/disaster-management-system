import { Shelter } from '../domain/coordination/Shelter.js';
import { ShelterStatus } from '../enums/ShelterStatus.js';
import { District as DistrictModel } from '../models/District.js';
import { OccupancyRecord as OccupancyRecordModel } from '../models/OccupancyRecord.js';
import { Shelter as ShelterModel } from '../models/Shelter.js';
import { ShelterRedirect as ShelterRedirectModel } from '../models/ShelterRedirect.js';
import { ApiError } from '../utils/ApiError.js';
import { GeoDistance } from '../utils/GeoDistance.js';
import { systemClock } from '../utils/SystemClock.js';
import { activeIncident as defaultActiveIncident } from './ActiveIncident.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 shelters: the ShelterController's work in sequence diagram (a). Every
// collaborator comes through the constructor.
export class ShelterService {
  #shelterModel;
  #occupancyRecordModel;
  #shelterRedirectModel;
  #districtModel;
  #districtScope;
  #activeIncident;
  #clock;

  constructor({
    shelterModel = ShelterModel,
    occupancyRecordModel = OccupancyRecordModel,
    shelterRedirectModel = ShelterRedirectModel,
    districtModel = DistrictModel,
    districtScope = defaultDistrictScope,
    activeIncident = defaultActiveIncident,
    clock = systemClock,
  } = {}) {
    this.#shelterModel = shelterModel;
    this.#occupancyRecordModel = occupancyRecordModel;
    this.#shelterRedirectModel = shelterRedirectModel;
    this.#districtModel = districtModel;
    this.#districtScope = districtScope;
    this.#activeIncident = activeIncident;
    this.#clock = clock;
  }

  /**
   * The shelters of the district the caller may see (findByDistrict in
   * sequence diagram (a)), sorted by name, in the contract's shape (§13.2).
   * @param {object} user The signed-in User.
   * @param {{ districtId?: string }} [query]
   * @returns {Promise<object[]>}
   */
  async list(user, { districtId } = {}) {
    const district = await this.#districtScope.readableDistrict(user, districtId);
    const docs = await this.#shelterModel
      .find({ district })
      .sort({ name: 1 })
      .populate(CoordinationPresenter.SHELTER_POPULATE);
    const redirects = await this.redirectsFor(docs);
    return docs.map((doc) => CoordinationPresenter.shelter(doc, redirects.get(String(doc._id))));
  }

  /**
   * UC03 A1 (contract §13.4.3): registers a new shelter in the officer's own
   * district during its active incident. It starts empty, so AVAILABLE. A name
   * already used in the district, ignoring case and surrounding spaces, is
   * refused; the Shelter model's unique index decides that, so two requests at
   * once can't both succeed.
   * @param {object} user The signed-in district officer.
   * @param {{ name: string, location: { lat: number, lng: number, label?: string }, capacity: number }} input Validated by the route.
   * @returns {Promise<{ shelter: object }>}
   * @throws {ApiError} 403 FORBIDDEN, 409 NO_ACTIVE_INCIDENT or 409 SHELTER_NAME_TAKEN.
   */
  async create(user, { name, location, capacity }) {
    const districtId = this.#districtScope.ownDistrict(user);
    await this.#activeIncident.require(districtId);

    let doc;
    try {
      doc = await this.#shelterModel.create({
        district: districtId,
        name,
        location,
        capacity,
        currentOccupancy: 0,
      });
    } catch (error) {
      if (error?.code === 11000) throw await this.#nameTaken(name, districtId);
      throw error;
    }

    await doc.populate(CoordinationPresenter.SHELTER_POPULATE);
    return { shelter: CoordinationPresenter.shelter(doc) };
  }

  async #nameTaken(name, districtId) {
    const district = await this.#districtModel.findById(districtId).select('name');
    return new ApiError(
      409,
      'SHELTER_NAME_TAKEN',
      `A shelter named "${name}" already exists in ${district?.name ?? 'this district'}.`,
    );
  }

  /**
   * UC03 main flow steps 3-5 (contract §13.4.2): sets how many people are in
   * a shelter of the officer's district during its active incident, keeps an
   * occupancy record of the update, and answers with the new rate and status.
   * A NEAR_CAPACITY or FULL result is flagged; the alternate-shelter
   * suggestion and the DMC alert come with A2 and E2.
   * @param {object} user The signed-in district officer.
   * @param {string} shelterId
   * @param {{ occupants: number }} input Validated by the route.
   * @returns {Promise<{ shelter: object, rate: number, status: string, flagged: boolean, alternateShelter: object|null, dmcAlerted: boolean }>}
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN or 409 NO_ACTIVE_INCIDENT.
   */
  async updateOccupancy(user, shelterId, { occupants }) {
    const doc = await this.#findShelter(shelterId);
    this.#districtScope.assertOwnDistrict(user, doc.district._id);
    await this.#activeIncident.require(doc.district._id);

    const shelter = Shelter.fromDocument(doc);
    shelter.updateOccupancy(occupants);
    doc.currentOccupancy = shelter.currentOccupancy;
    await doc.save();

    await this.#occupancyRecordModel.create({
      shelter: doc._id,
      district: doc.district._id,
      occupants,
      capacity: doc.capacity,
      recordedAt: this.#clock.now(),
      recordedBy: user._id,
    });

    const redirects = await this.redirectsFor([doc]);
    const presented = CoordinationPresenter.shelter(doc, redirects.get(String(doc._id)));
    const flagged = [ShelterStatus.NEAR_CAPACITY, ShelterStatus.FULL].includes(presented.status);
    return {
      shelter: presented,
      rate: presented.rate,
      status: presented.status,
      flagged,
      // A2: the nearest shelter that can still take people, if there is one.
      alternateShelter: flagged
        ? await this.findNearestWithSpace({
            location: doc.location,
            district: doc.district._id,
            excludeShelterId: doc._id,
          })
        : null,
      // Filled in by E2 (DMS-148).
      dmcAlerted: false,
    };
  }

  /**
   * UC03 A2.3 (redirect in sequence diagram (a), contract §13.4.4): records
   * that new arrivals at a shelter of the officer's district go to another
   * shelter of it instead. The target must still have spare capacity (below
   * 90%) at this moment - it may have filled up since it was suggested - or
   * nothing is stored. The shelter being redirected need not be flagged now;
   * its `redirectingTo` only shows while it is, so the redirect ends by itself
   * when it drops below 90%.
   * @param {object} user The signed-in district officer.
   * @param {string} shelterId The shelter being redirected away from.
   * @param {{ toShelterId: string }} input Validated by the route.
   * @returns {Promise<object>} The redirect record (§13.4.4).
   * @throws {ApiError} 404 NOT_FOUND, 403 FORBIDDEN, 409 NO_ACTIVE_INCIDENT, 400 VALIDATION_ERROR or 409 SHELTER_NO_SPACE.
   */
  async redirect(user, shelterId, { toShelterId }) {
    const from = await this.#findShelter(shelterId);
    this.#districtScope.assertOwnDistrict(user, from.district._id);
    await this.#activeIncident.require(from.district._id);

    const to = await this.#findShelter(toShelterId);
    const targetProblem = ShelterService.#redirectTargetProblem(from, to);
    if (targetProblem) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
        { field: 'toShelterId', message: targetProblem },
      ]);
    }

    const target = Shelter.fromDocument(to);
    if (!target.hasSpareCapacity()) {
      throw new ApiError(
        409,
        'SHELTER_NO_SPACE',
        `${to.name} has no spare capacity (${Math.round(target.occupancyRate() * 100)}%).`,
      );
    }

    const doc = await this.#shelterRedirectModel.create({
      from: from._id,
      to: to._id,
      district: from.district._id,
      by: user._id,
      at: this.#clock.now(),
    });
    await doc.populate(CoordinationPresenter.REDIRECT_POPULATE);
    return CoordinationPresenter.redirect(doc);
  }

  // Why a shelter can't be the redirect's target, or null: it is the shelter
  // itself, or in another district.
  static #redirectTargetProblem(from, to) {
    if (String(from._id) === String(to._id)) return 'must be another shelter';
    if (String(from.district._id) !== String(to.district._id)) {
      return 'must be a shelter in the same district';
    }
    return null;
  }

  /**
   * The shelter each given shelter is redirecting new arrivals to (contract
   * §13.2 `redirectingTo`): the target of its latest redirect, by shelter id as
   * `{ id, name }`. Only shelters that are NEAR_CAPACITY or FULL are looked up,
   * since a redirect is only shown while the shelter is.
   * @param {object[]} shelterDocs Shelter documents.
   * @returns {Promise<Map<string, { id: string, name: string }>>}
   */
  async redirectsFor(shelterDocs) {
    const flagged = shelterDocs.filter((doc) => !Shelter.fromDocument(doc).hasSpareCapacity());
    if (flagged.length === 0) return new Map();

    const records = await this.#shelterRedirectModel
      .find({ from: { $in: flagged.map((doc) => doc._id) } })
      .sort({ at: -1, _id: -1 })
      .populate({ path: 'to', select: 'name' });

    const latest = new Map();
    for (const record of records) {
      const key = String(record.from);
      if (!latest.has(key)) {
        latest.set(key, CoordinationPresenter.reference(record.to, ['name']));
      }
    }
    return latest;
  }

  /**
   * UC03 A2.2 (findNearestWithSpace in sequence diagram (a), contract §13.4.2):
   * the shelter in the district nearest to `location` that still has spare
   * capacity (AVAILABLE or FILLING_UP, below 90%), never the one being asked
   * about. Nearest is by straight-line distance, a tie going to the name that
   * sorts first. Null when none has space (E2).
   * @param {{ location: { lat: number, lng: number }, district: object|string, excludeShelterId?: object|string }} query
   * @returns {Promise<{ id: string, name: string, rate: number, status: string, distanceKm: number }|null>}
   */
  async findNearestWithSpace({ location, district, excludeShelterId }) {
    const filter = { district };
    if (excludeShelterId) filter._id = { $ne: excludeShelterId };
    const docs = await this.#shelterModel.find(filter);

    const [nearest] = docs
      .map((doc) => ({ doc, shelter: Shelter.fromDocument(doc) }))
      .filter(({ shelter }) => shelter.hasSpareCapacity())
      .map((candidate) => ({
        ...candidate,
        metres: GeoDistance.haversineMetres(location, candidate.doc.location),
      }))
      .sort((a, b) => a.metres - b.metres || a.doc.name.localeCompare(b.doc.name));
    if (!nearest) return null;

    return {
      id: String(nearest.doc._id),
      name: nearest.doc.name,
      rate: nearest.shelter.occupancyRate(),
      status: nearest.shelter.status(),
      distanceKm: Math.round(nearest.metres / 100) / 10,
    };
  }

  static #OBJECT_ID = /^[0-9a-fA-F]{24}$/;

  // An unknown or malformed id is the same 404 (contract §13.1).
  async #findShelter(shelterId) {
    const doc = ShelterService.#OBJECT_ID.test(shelterId)
      ? await this.#shelterModel
          .findById(shelterId)
          .populate(CoordinationPresenter.SHELTER_POPULATE)
      : null;
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Shelter not found.');
    return doc;
  }
}

export const shelterService = new ShelterService();
