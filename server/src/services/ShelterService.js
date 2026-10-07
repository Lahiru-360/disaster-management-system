import { Shelter } from '../domain/coordination/Shelter.js';
import { ShelterStatus } from '../enums/ShelterStatus.js';
import { OccupancyRecord as OccupancyRecordModel } from '../models/OccupancyRecord.js';
import { Shelter as ShelterModel } from '../models/Shelter.js';
import { ApiError } from '../utils/ApiError.js';
import { systemClock } from '../utils/SystemClock.js';
import { activeIncident as defaultActiveIncident } from './ActiveIncident.js';
import { CoordinationPresenter } from './CoordinationPresenter.js';
import { districtScope as defaultDistrictScope } from './DistrictScope.js';

// UC03 shelters: the ShelterController's work in sequence diagram (a). Every
// collaborator comes through the constructor.
export class ShelterService {
  #shelterModel;
  #occupancyRecordModel;
  #districtScope;
  #activeIncident;
  #clock;

  constructor({
    shelterModel = ShelterModel,
    occupancyRecordModel = OccupancyRecordModel,
    districtScope = defaultDistrictScope,
    activeIncident = defaultActiveIncident,
    clock = systemClock,
  } = {}) {
    this.#shelterModel = shelterModel;
    this.#occupancyRecordModel = occupancyRecordModel;
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
    return docs.map((doc) => CoordinationPresenter.shelter(doc));
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

    const presented = CoordinationPresenter.shelter(doc);
    return {
      shelter: presented,
      rate: presented.rate,
      status: presented.status,
      flagged: [ShelterStatus.NEAR_CAPACITY, ShelterStatus.FULL].includes(presented.status),
      // Filled in by A2 (DMS-145) and E2 (DMS-148).
      alternateShelter: null,
      dmcAlerted: false,
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
