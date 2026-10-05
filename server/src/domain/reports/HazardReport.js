import { DismissalReason } from '../../enums/DismissalReason.js';
import { ReportStatus } from '../../enums/ReportStatus.js';
import { Coordinates } from './Coordinates.js';
import { ReportAlreadyReviewedError } from './ReportAlreadyReviewedError.js';

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

// A citizen's ground report and its review (UC02 class diagram). It holds the
// state machine PENDING → CONFIRMED | DISMISSED: both reviews are only allowed
// from PENDING and both are final, so a second review throws
// ReportAlreadyReviewedError (E3). It never saves itself or notifies anyone -
// HazardReportService does that after asking it to change.
//
// The review time is passed in rather than read here, so the service's
// injected clock decides it and tests can fix it.
export class HazardReport {
  static #NOTE_MAX_LENGTH = 200;

  #id;
  #referenceNo;
  #reporterId;
  #description;
  #photoUrl;
  #hazardType;
  #location;
  #locationSource;
  #districtId;
  #status;
  #submittedAt;
  #reviewedById;
  #reviewedAt;
  #dismissalReason;
  #dismissalNote;
  #clusterId;

  /**
   * @param {object} fields The stored report's fields. `location` is a
   *   Coordinates or { latitude, longitude }; `reporter`, `district`,
   *   `reviewedBy` and `clusterId` may be documents or ids.
   */
  constructor({
    id,
    referenceNo,
    reporter,
    description,
    photoUrl,
    hazardType,
    location,
    locationSource,
    district,
    status = ReportStatus.PENDING,
    submittedAt,
    reviewedBy = null,
    reviewedAt = null,
    dismissalReason = null,
    dismissalNote = null,
    clusterId,
  } = {}) {
    if (!Object.values(ReportStatus).includes(status)) {
      throw new Error(`HazardReport: unknown status "${status}"`);
    }
    this.#id = idOf(id);
    this.#referenceNo = referenceNo;
    this.#reporterId = idOf(reporter);
    this.#description = description;
    this.#photoUrl = photoUrl;
    this.#hazardType = hazardType;
    this.#location =
      location instanceof Coordinates || !location ? location : new Coordinates(location);
    this.#locationSource = locationSource;
    this.#districtId = idOf(district);
    this.#status = status;
    this.#submittedAt = submittedAt;
    this.#reviewedById = idOf(reviewedBy);
    this.#reviewedAt = reviewedAt;
    this.#dismissalReason = dismissalReason;
    this.#dismissalNote = dismissalNote;
    this.#clusterId = idOf(clusterId);
  }

  /**
   * Builds the domain object from a stored HazardReport document (or its
   * lean object), turning the GeoJSON location into Coordinates.
   * @param {object} doc
   * @returns {HazardReport}
   */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new HazardReport({
      ...fields,
      id: fields._id ?? fields.id,
      location: fields.location?.coordinates
        ? Coordinates.fromGeoJSON(fields.location)
        : fields.location,
    });
  }

  /**
   * The duty officer confirms the report (step 13): it becomes CONFIRMED and
   * eligible for escalation. Confirming never creates or changes a warning.
   * @param {{ id: string }|string} officer The reviewing duty officer, or their id.
   * @param {Date} at When they confirmed it.
   * @throws {ReportAlreadyReviewedError} If it is no longer PENDING (E3).
   */
  confirm(officer, at) {
    this.#review(officer, at);
    this.#status = ReportStatus.CONFIRMED;
  }

  /**
   * The duty officer dismisses the report with a reason (A1.2). It is not
   * eligible for escalation.
   * @param {{ id: string }|string} officer The reviewing duty officer, or their id.
   * @param {string} reason A DismissalReason.
   * @param {string|null} [note] Optional, at most 200 characters.
   * @param {Date} at When they dismissed it.
   * @throws {ReportAlreadyReviewedError} If it is no longer PENDING (E3).
   */
  dismiss(officer, reason, note, at) {
    if (!Object.values(DismissalReason).includes(reason)) {
      throw new Error(`HazardReport: unknown dismissal reason "${reason}"`);
    }
    const trimmedNote = note?.trim() || null;
    if (trimmedNote && trimmedNote.length > HazardReport.#NOTE_MAX_LENGTH) {
      throw new Error(
        `HazardReport: dismissal note is over ${HazardReport.#NOTE_MAX_LENGTH} characters`,
      );
    }
    this.#review(officer, at);
    this.#status = ReportStatus.DISMISSED;
    this.#dismissalReason = reason;
    this.#dismissalNote = trimmedNote;
  }

  /**
   * Whether UC01 may escalate this report into a warning (A1): only once a
   * duty officer has confirmed it.
   * @returns {boolean}
   */
  isEscalatable() {
    return this.#status === ReportStatus.CONFIRMED;
  }

  // Shared by confirm and dismiss: only a PENDING report can be reviewed, and
  // every review records who and when.
  #review(officer, at) {
    if (this.#status !== ReportStatus.PENDING) {
      throw new ReportAlreadyReviewedError(this.#status);
    }
    const officerId = idOf(officer);
    if (!officerId) {
      throw new Error('HazardReport: a review needs the reviewing officer');
    }
    if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
      throw new Error('HazardReport: a review needs the time it happened');
    }
    this.#reviewedById = officerId;
    this.#reviewedAt = at;
  }

  get id() {
    return this.#id;
  }

  get referenceNo() {
    return this.#referenceNo;
  }

  get reporterId() {
    return this.#reporterId;
  }

  get description() {
    return this.#description;
  }

  get photoUrl() {
    return this.#photoUrl;
  }

  get hazardType() {
    return this.#hazardType;
  }

  /** @returns {Coordinates} */
  get location() {
    return this.#location;
  }

  get locationSource() {
    return this.#locationSource;
  }

  get districtId() {
    return this.#districtId;
  }

  get status() {
    return this.#status;
  }

  get submittedAt() {
    return this.#submittedAt;
  }

  get reviewedById() {
    return this.#reviewedById;
  }

  get reviewedAt() {
    return this.#reviewedAt;
  }

  get dismissalReason() {
    return this.#dismissalReason;
  }

  get dismissalNote() {
    return this.#dismissalNote;
  }

  get clusterId() {
    return this.#clusterId;
  }

  /**
   * The review fields to write back after confirm() or dismiss(), for the
   * service's conditional update on { status: PENDING } (E3).
   * @returns {{ status: string, reviewedBy: string, reviewedAt: Date, dismissalReason: string|null, dismissalNote: string|null }}
   */
  reviewChanges() {
    return {
      status: this.#status,
      reviewedBy: this.#reviewedById,
      reviewedAt: this.#reviewedAt,
      dismissalReason: this.#dismissalReason,
      dismissalNote: this.#dismissalNote,
    };
  }
}
