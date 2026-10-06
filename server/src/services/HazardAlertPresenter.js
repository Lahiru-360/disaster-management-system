// Every model an alert references, so populate() finds each one registered
// even when nothing else in the process has loaded it yet.
import '../models/District.js';
import '../models/HazardEvent.js';
import '../models/HazardReport.js';
import '../models/RiverBasin.js';
import '../models/User.js';

// Turns a stored hazard alert into the contract's alert object (§12.1): the
// targets as { kind, id, name }, the people as { id, name }, the event as
// { id, name } and the source report as { id, referenceNo }. Shared by the
// UC01 services, so every endpoint returns the same shape.
export class HazardAlertPresenter {
  /**
   * @param {import('mongoose').Document} doc A HazardAlert document.
   * @returns {Promise<object>}
   */
  static async present(doc) {
    await doc.populate([
      { path: 'targets.area', select: 'name' },
      { path: 'createdBy', select: 'name' },
      { path: 'issuedBy', select: 'name' },
      { path: 'statusHistory.by', select: 'name' },
      { path: 'event', select: 'name' },
      { path: 'sourceReport', select: 'referenceNo' },
    ]);
    const json = doc.toJSON();
    const idAndName = (populated) => HazardAlertPresenter.#idAndFields(populated, ['name']);

    json.targets = json.targets.map(({ kind, area }) => ({
      kind,
      id: HazardAlertPresenter.#idOf(area),
      name: area?.name ?? null,
    }));
    json.createdBy = idAndName(json.createdBy);
    json.issuedBy = idAndName(json.issuedBy);
    json.event = idAndName(json.event);
    json.sourceReport = HazardAlertPresenter.#idAndFields(json.sourceReport, ['referenceNo']);
    json.statusHistory = json.statusHistory.map(({ status, version, at, by }) => ({
      status,
      version,
      at,
      by: idAndName(by),
    }));
    return json;
  }

  // The id of a reference, populated (already through its model's toJSON,
  // which renames _id to id) or not. An ObjectId is checked first: it has an
  // `id` property of its own (its raw bytes), which is not the id we want.
  static #idOf(value) {
    if (typeof value?.toHexString === 'function') return value.toHexString();
    return String(value?.id ?? value?._id ?? value);
  }

  // A populated reference as { id, ...fields }; null when there is none.
  static #idAndFields(populated, fields) {
    if (!populated) return null;
    return Object.fromEntries([
      ['id', HazardAlertPresenter.#idOf(populated)],
      ...fields.map((field) => [field, populated[field] ?? null]),
    ]);
  }
}
