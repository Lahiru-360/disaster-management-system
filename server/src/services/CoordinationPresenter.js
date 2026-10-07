import mongoose from 'mongoose';
import { Shelter } from '../domain/coordination/Shelter.js';
import { ShelterStatus } from '../enums/ShelterStatus.js';

// Turns UC03 documents into the objects the contract defines (§13.2), so
// every coordination endpoint returns the same shapes. Expects documents with
// their references populated; an unpopulated reference becomes { id } only.
export class CoordinationPresenter {
  // What each object needs populated, so every service loads the same fields.
  static SHELTER_POPULATE = [{ path: 'district', select: 'name' }];

  static TEAM_POPULATE = [
    { path: 'organisation', select: 'name type' },
    { path: 'district', select: 'name' },
    { path: 'lead', select: 'name' },
  ];

  static STOCK_POPULATE = [
    { path: 'organisation', select: 'name type' },
    { path: 'district', select: 'name' },
  ];

  static DISTRIBUTION_POPULATE = [
    { path: 'shelter', select: 'name' },
    { path: 'stock', select: 'unit' },
    { path: 'organisation', select: 'name type' },
    { path: 'district', select: 'name' },
    { path: 'loggedBy', select: 'name' },
  ];

  static REDIRECT_POPULATE = [
    { path: 'from', select: 'name' },
    { path: 'to', select: 'name' },
    { path: 'district', select: 'name' },
    { path: 'by', select: 'name' },
  ];

  static DISPATCH_POPULATE = [
    {
      path: 'team',
      select: 'name organisation',
      populate: { path: 'organisation', select: 'name type' },
    },
    { path: 'district', select: 'name' },
    { path: 'incident', select: 'name' },
    { path: 'createdBy', select: 'name' },
    { path: 'statusHistory.by', select: 'name' },
  ];

  /**
   * The contract's shelter object: district as { id, name }, plus the rate
   * and status from the Shelter domain class.
   * @param {object} doc A Shelter document, district populated.
   * @param {{ id: string, name: string }|null} [redirectingTo] The target of the latest
   *   redirect from this shelter. Shown only while the shelter is NEAR_CAPACITY or FULL.
   * @returns {object}
   */
  static shelter(doc, redirectingTo = null) {
    const json = doc.toJSON();
    const shelter = Shelter.fromDocument(doc);
    return {
      id: String(json.id),
      name: json.name,
      district: CoordinationPresenter.reference(json.district, ['name']),
      location: CoordinationPresenter.#location(json.location),
      capacity: json.capacity,
      currentOccupancy: json.currentOccupancy,
      rate: shelter.occupancyRate(),
      status: shelter.status(),
      redirectingTo: [ShelterStatus.NEAR_CAPACITY, ShelterStatus.FULL].includes(shelter.status())
        ? redirectingTo
        : null,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * The contract's redirect record (§13.4.4): the two shelters, the district
   * and the officer as { id, name }.
   * @param {object} doc A ShelterRedirect document, from, to, district and by populated.
   * @returns {object}
   */
  static redirect(doc) {
    const json = doc.toJSON();
    return {
      id: String(json.id),
      from: CoordinationPresenter.reference(json.from, ['name']),
      to: CoordinationPresenter.reference(json.to, ['name']),
      district: CoordinationPresenter.reference(json.district, ['name']),
      by: CoordinationPresenter.reference(json.by, ['name']),
      at: json.at,
    };
  }

  /**
   * The contract's rescue team object, with its owning organisation.
   * @param {object} doc A RescueTeam document, organisation, district and lead populated.
   * @param {object|null} [currentTask] The team's open dispatch, once dispatches exist (DMS-142).
   * @returns {object}
   */
  static team(doc, currentTask = null) {
    const json = doc.toJSON();
    return {
      id: String(json.id),
      name: json.name,
      organisation: CoordinationPresenter.organisation(json.organisation),
      district: CoordinationPresenter.reference(json.district, ['name']),
      memberCount: json.memberCount,
      lead: CoordinationPresenter.reference(json.lead, ['name']),
      baseLocation: CoordinationPresenter.#location(json.baseLocation),
      currentLocation: CoordinationPresenter.#location(json.currentLocation),
      status: json.status,
      currentTask,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * The contract's relief stock object, with its owning organisation.
   * @param {object} doc A ReliefStock document, populated with STOCK_POPULATE.
   * @returns {object}
   */
  static stock(doc) {
    const json = doc.toJSON();
    return {
      id: String(json.id),
      organisation: CoordinationPresenter.organisation(json.organisation),
      district: CoordinationPresenter.reference(json.district, ['name']),
      supplyType: json.supplyType,
      unit: json.unit,
      quantityAvailable: json.quantityAvailable,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * The contract's supply distribution object; unit comes from the stock row.
   * @param {object} doc A SupplyDistribution document, shelter, stock, organisation, district and loggedBy populated.
   * @returns {object}
   */
  static distribution(doc) {
    const json = doc.toJSON();
    return {
      id: String(json.id),
      shelter: CoordinationPresenter.reference(json.shelter, ['name']),
      stockId: CoordinationPresenter.#idOf(json.stock),
      organisation: CoordinationPresenter.organisation(json.organisation),
      district: CoordinationPresenter.reference(json.district, ['name']),
      supplyType: json.supplyType,
      unit: json.stock?.unit ?? null,
      quantity: json.quantity,
      distributedAt: json.distributedAt,
      loggedBy: CoordinationPresenter.reference(json.loggedBy, ['name']),
    };
  }

  /**
   * The contract's dispatch object, with the team's owning organisation.
   * @param {object} doc A Dispatch document, populated with DISPATCH_POPULATE.
   * @returns {object}
   */
  static dispatch(doc) {
    const json = doc.toJSON();
    const team = json.team
      ? {
          ...CoordinationPresenter.reference(json.team, ['name']),
          organisation: CoordinationPresenter.organisation(json.team.organisation),
        }
      : null;
    return {
      id: String(json.id),
      status: json.status,
      team,
      district: CoordinationPresenter.reference(json.district, ['name']),
      incident: CoordinationPresenter.reference(json.incident, ['name']),
      incidentLocation: CoordinationPresenter.#location(json.incidentLocation),
      priority: json.priority,
      supportRequested: json.supportRequested ?? false,
      createdBy: CoordinationPresenter.reference(json.createdBy, ['name']),
      createdAt: json.createdAt,
      ackDeadline: json.ackDeadline ?? null,
      declineReason: json.declineReason ?? null,
      statusHistory: (json.statusHistory ?? []).map((entry) => ({
        status: entry.status,
        at: entry.at,
        by: CoordinationPresenter.reference(entry.by, ['name']),
      })),
    };
  }

  /**
   * An organisation reference: { id, name, type }.
   * @param {object|null} populated
   * @returns {object|null}
   */
  static organisation(populated) {
    return CoordinationPresenter.reference(populated, ['name', 'type']);
  }

  /**
   * { id, ...fields } from a populated reference or plain object, or null.
   * @param {object|null|undefined} populated
   * @param {string[]} fields
   * @returns {object|null}
   */
  static reference(populated, fields) {
    if (populated === null || populated === undefined) return null;
    return Object.fromEntries([
      ['id', CoordinationPresenter.#idOf(populated)],
      ...fields.map((field) => [field, populated[field]]),
    ]);
  }

  // An ObjectId's own .id is its raw bytes, so ids and strings are handled
  // before looking for an id on a populated document.
  static #idOf(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof mongoose.Types.ObjectId || typeof value === 'string') return String(value);
    return String(value.id ?? value._id);
  }

  // A location always carries label, null when none was given. Mongoose
  // returns an unset nested path as {}, which is no location either.
  static #location(location) {
    if (!location || location.lat === undefined) return null;
    return { lat: location.lat, lng: location.lng, label: location.label ?? null };
  }
}
