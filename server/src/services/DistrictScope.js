import { DistrictOfficer } from '../domain/people/DistrictOfficer.js';
import { DMCOfficer } from '../domain/people/DMCOfficer.js';
import { PersonFactory } from '../domain/people/PersonFactory.js';
import { District as DistrictModel } from '../models/District.js';
import { ApiError } from '../utils/ApiError.js';

// Which district a UC03 caller may work in (contract §13.1). A district
// officer only ever works in the district on their profile; DMC officers
// (dmc_officer, and duty_officer as one) may read any district but must name
// it. Role checks happen on the route; this decides the district.
export class DistrictScope {
  #districtModel;

  constructor({ districtModel = DistrictModel } = {}) {
    this.#districtModel = districtModel;
  }

  /**
   * The district a read is for. A district officer's defaults to their own and
   * may not be another; a DMC officer's must be given.
   * @param {object} user The signed-in User.
   * @param {string} [requestedDistrictId] The `districtId` query parameter.
   * @returns {Promise<string>} The district id, known to exist.
   * @throws {ApiError} 403 FORBIDDEN, 400 VALIDATION_ERROR or 404 NOT_FOUND.
   */
  async readableDistrict(user, requestedDistrictId) {
    const person = PersonFactory.fromUser(user);

    if (person instanceof DistrictOfficer) {
      const own = DistrictScope.#ownDistrict(person);
      if (requestedDistrictId && requestedDistrictId !== own) {
        throw DistrictScope.#notYourDistrict();
      }
      return own;
    }

    if (person instanceof DMCOfficer) {
      if (!requestedDistrictId) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
          { field: 'districtId', message: 'districtId is required' },
        ]);
      }
      if (!(await this.#districtModel.exists({ _id: requestedDistrictId }))) {
        throw new ApiError(404, 'NOT_FOUND', 'District not found.');
      }
      return requestedDistrictId;
    }

    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }

  /**
   * Refuses a district officer acting on a record outside their district.
   * @param {object} user The signed-in User (a district officer).
   * @param {object|string} districtId The record's district.
   * @throws {ApiError} 403 FORBIDDEN.
   */
  assertOwnDistrict(user, districtId) {
    const person = PersonFactory.fromUser(user);
    if (!(person instanceof DistrictOfficer)) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    }
    if (String(districtId) !== DistrictScope.#ownDistrict(person)) {
      throw DistrictScope.#notYourDistrict();
    }
  }

  // A district officer with no district on their profile can't coordinate anything.
  static #ownDistrict(officer) {
    if (!officer.district) {
      throw new ApiError(403, 'FORBIDDEN', 'No district is assigned to your account.');
    }
    return String(officer.district._id ?? officer.district);
  }

  static #notYourDistrict() {
    return new ApiError(403, 'FORBIDDEN', 'You can only coordinate your own district.');
  }
}

export const districtScope = new DistrictScope();
