import { AlertHazardType } from '../../enums/AlertHazardType.js';
import { AlertStatus } from '../../enums/AlertStatus.js';
import { SeverityLevel } from '../../enums/SeverityLevel.js';
import { District } from '../areas/District.js';
import { RiverBasin } from '../areas/RiverBasin.js';
import { InvalidAlertTransitionError } from './InvalidAlertTransitionError.js';

// The id, as a string, of something given as a document, a plain { id }, an
// ObjectId or a string. An ObjectId is checked first: it has an `id` property
// of its own (its raw bytes), which is not the id we want.
const idOf = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value.toHexString === 'function') {
    return String(value);
  }
  return idOf(value.id ?? value._id);
};

// A target as { kind, areaId }, from a TargetArea or a stored { kind, area }.
const targetOf = (target) => {
  if (target instanceof District) return { kind: 'District', areaId: target.areaId };
  if (target instanceof RiverBasin) return { kind: 'RiverBasin', areaId: target.areaId };
  if (target?.kind === 'District' || target?.kind === 'RiverBasin') {
    return { kind: target.kind, areaId: idOf(target.areaId ?? target.area) };
  }
  throw new Error('HazardAlert: a target must be a District or a RiverBasin');
};

// A hazard warning (UC01 class diagram). It holds the state machine
// DRAFT → BROADCAST → UPDATED (each update, version + 1) → CANCELLED (all-clear),
// where BROADCAST and UPDATED are active. A step the current status doesn't
// allow throws InvalidAlertTransitionError (409). Composing - type, severity,
// scope and message - is only allowed while DRAFT. It never saves itself or
// sends anything: WarningService and BroadcastService do that after asking
// it to change.
//
// Every status change records who and when in the history. The time is passed
// in rather than read here, so the service's injected clock decides it and
// tests can fix it.
export class HazardAlert {
  static #MESSAGE_MAX_LENGTH = 160;
  static #ACTIVE = [AlertStatus.BROADCAST, AlertStatus.UPDATED];

  #id;
  #referenceNo;
  #hazardType;
  #severity;
  #message;
  #status;
  #version;
  #targets;
  #eventId;
  #sourceReportId;
  #createdById;
  #issuedById;
  #issuedAt;
  #statusHistory;

  /**
   * @param {object} fields The stored alert's fields. `targets` are TargetArea
   *   objects or stored { kind, area }; the people and references may be
   *   documents or ids.
   */
  constructor({
    id,
    referenceNo,
    hazardType = null,
    severity = null,
    message = null,
    status = AlertStatus.DRAFT,
    version = 1,
    targets = [],
    event = null,
    sourceReport = null,
    createdBy,
    issuedBy = null,
    issuedAt = null,
    statusHistory = [],
  } = {}) {
    if (!Object.values(AlertStatus).includes(status)) {
      throw new Error(`HazardAlert: unknown status "${status}"`);
    }
    this.#id = idOf(id);
    this.#referenceNo = referenceNo;
    this.#hazardType = hazardType;
    this.#severity = severity;
    this.#message = message;
    this.#status = status;
    this.#version = version;
    this.#targets = targets.map(targetOf);
    this.#eventId = idOf(event);
    this.#sourceReportId = idOf(sourceReport);
    this.#createdById = idOf(createdBy);
    this.#issuedById = idOf(issuedBy);
    this.#issuedAt = issuedAt;
    this.#statusHistory = statusHistory.map(({ status: entryStatus, version: v, at, by }) => ({
      status: entryStatus,
      version: v,
      at,
      byId: idOf(by),
    }));
  }

  /**
   * A new DRAFT, version 1, opened when the officer starts composing (step 2).
   * @param {{ referenceNo: string, officer: object|string, at: Date, sourceReport?: object|string }} draft
   */
  static startDraft({ referenceNo, officer, at, sourceReport = null }) {
    const alert = new HazardAlert({ referenceNo, createdBy: officer, sourceReport });
    alert.#record(AlertStatus.DRAFT, officer, at);
    return alert;
  }

  /** A HazardAlert for a stored alert (a document or a plain object). */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new HazardAlert({ ...fields, id: fields._id ?? fields.id });
  }

  /**
   * Sets what the draft warns about (steps 3-7): its type, severity and scope,
   * the message generated for them, and the hazard event covering the scope.
   * @param {{ hazardType: string, severity: string, targets: object[], message: string, event?: object|string|null }} draft
   * @throws {InvalidAlertTransitionError} If it is no longer DRAFT.
   */
  compose({ hazardType, severity, targets, message, event = null }) {
    this.#requireDraft('previewed');
    HazardAlert.#requireHazardType(hazardType);
    HazardAlert.#requireSeverity(severity);
    // Everything is checked before anything changes, so a refused draft is left as it was.
    const scope = HazardAlert.#scopeOf(targets);
    const text = HazardAlert.#validMessage(message);
    this.#hazardType = hazardType;
    this.#severity = severity;
    this.#targets = scope;
    this.#message = text;
    this.#eventId = idOf(event);
  }

  /**
   * Replaces the message with the officer's edit (step 8).
   * @param {string} message At most 160 characters.
   * @throws {InvalidAlertTransitionError} If it is no longer DRAFT.
   */
  editMessage(message) {
    this.#requireDraft('edited');
    this.#message = HazardAlert.#validMessage(message);
  }

  /**
   * Sends the warning (step 12): DRAFT → BROADCAST, recording the issuing
   * officer and time.
   * @param {object|string} officer The issuing officer, or their id.
   * @param {Date} at
   * @param {string|null} [message] The text as the officer last saw it, which
   *   replaces the draft's; null keeps it.
   * @throws {InvalidAlertTransitionError} If it isn't a DRAFT, or was never
   *   previewed so has no type, severity, scope or message.
   */
  broadcast(officer, at, message = null) {
    this.#requireDraft('broadcast');
    if (message !== null) this.#message = HazardAlert.#validMessage(message);
    if (!this.#hazardType || !this.#severity || this.#targets.length === 0 || !this.#message) {
      throw new InvalidAlertTransitionError(
        'Preview the warning before broadcasting it',
        this.#status,
      );
    }
    this.#record(AlertStatus.BROADCAST, officer, at);
    this.#issuedById = idOf(officer);
    this.#issuedAt = at;
  }

  /**
   * Checks that the draft may be thrown away (A4): only a DRAFT, which has
   * sent nothing, can be. Removing it is the service's job.
   * @throws {InvalidAlertTransitionError} If it is no longer DRAFT.
   */
  discard() {
    this.#requireDraft('discarded');
  }

  /**
   * Changes an active warning's severity and/or scope (A2): it becomes UPDATED
   * with the next version.
   * @param {string|null} severity The new severity, or null to keep it.
   * @param {object[]|null} areas The new scope, or null to keep it.
   * @param {object|string} officer
   * @param {Date} at
   * @throws {InvalidAlertTransitionError} If it isn't active.
   */
  update(severity, areas, officer, at) {
    this.#requireActive('updated');
    if (severity !== null && severity !== undefined) HazardAlert.#requireSeverity(severity);
    const scope = areas === null || areas === undefined ? null : HazardAlert.#scopeOf(areas);
    if (severity) this.#severity = severity;
    if (scope) this.#targets = scope;
    this.#version += 1;
    this.#record(AlertStatus.UPDATED, officer, at);
  }

  /**
   * Ends an active warning with an all-clear (A3): it becomes CANCELLED.
   * @param {object|string} officer
   * @param {Date} at
   * @throws {InvalidAlertTransitionError} If it isn't active.
   */
  cancel(officer, at) {
    this.#requireActive('cancelled');
    this.#record(AlertStatus.CANCELLED, officer, at);
  }

  /** True while the warning is in force: BROADCAST or UPDATED. */
  isActive() {
    return HazardAlert.#ACTIVE.includes(this.#status);
  }

  #requireDraft(action) {
    if (this.#status !== AlertStatus.DRAFT) {
      throw new InvalidAlertTransitionError(
        `Only a DRAFT alert can be ${action} – current status: ${this.#status}`,
        this.#status,
      );
    }
  }

  #requireActive(action) {
    if (!this.isActive()) {
      throw new InvalidAlertTransitionError(
        `Only an active alert can be ${action} – current status: ${this.#status}`,
        this.#status,
      );
    }
  }

  // Every status change: the new status at the current version, by whom, when.
  #record(status, officer, at) {
    const byId = idOf(officer);
    if (!byId) {
      throw new Error('HazardAlert: a status change needs the officer making it');
    }
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
      throw new Error('HazardAlert: a status change needs the time it happened');
    }
    this.#status = status;
    this.#statusHistory.push({ status, version: this.#version, at, byId });
  }

  static #requireHazardType(hazardType) {
    if (!Object.values(AlertHazardType).includes(hazardType)) {
      throw new Error(`HazardAlert: unknown hazard type "${hazardType}"`);
    }
  }

  static #requireSeverity(severity) {
    if (!Object.values(SeverityLevel).includes(severity)) {
      throw new Error(`HazardAlert: unknown severity "${severity}"`);
    }
  }

  static #scopeOf(targets) {
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new Error('HazardAlert: the scope needs at least one area');
    }
    return targets.map(targetOf);
  }

  static #validMessage(message) {
    const text = typeof message === 'string' ? message.trim() : '';
    if (text.length === 0 || text.length > HazardAlert.#MESSAGE_MAX_LENGTH) {
      throw new Error(
        `HazardAlert: the message must be 1-${HazardAlert.#MESSAGE_MAX_LENGTH} characters`,
      );
    }
    return text;
  }

  get id() {
    return this.#id;
  }

  get referenceNo() {
    return this.#referenceNo;
  }

  get hazardType() {
    return this.#hazardType;
  }

  get severity() {
    return this.#severity;
  }

  get message() {
    return this.#message;
  }

  get status() {
    return this.#status;
  }

  get version() {
    return this.#version;
  }

  /** The scope, as [{ kind, areaId }], in the order it was chosen. */
  get targets() {
    return this.#targets.map((target) => ({ ...target }));
  }

  get eventId() {
    return this.#eventId;
  }

  get sourceReportId() {
    return this.#sourceReportId;
  }

  get createdById() {
    return this.#createdById;
  }

  get issuedById() {
    return this.#issuedById;
  }

  get issuedAt() {
    return this.#issuedAt;
  }

  /** Every status change, oldest first, as [{ status, version, at, byId }]. */
  get statusHistory() {
    return this.#statusHistory.map((entry) => ({ ...entry }));
  }

  /**
   * The stored fields, in the HazardAlert model's shape, for the service to
   * save. Leaves out the reference number and creator, which never change.
   */
  toFields() {
    return {
      hazardType: this.#hazardType,
      severity: this.#severity,
      message: this.#message,
      status: this.#status,
      version: this.#version,
      targets: this.#targets.map(({ kind, areaId }) => ({ kind, area: areaId })),
      event: this.#eventId,
      sourceReport: this.#sourceReportId,
      issuedBy: this.#issuedById,
      issuedAt: this.#issuedAt,
      statusHistory: this.#statusHistory.map(({ status, version, at, byId }) => ({
        status,
        version,
        at,
        by: byId,
      })),
    };
  }
}
