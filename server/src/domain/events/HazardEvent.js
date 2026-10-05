import { EventStatus } from '../../enums/EventStatus.js';
import { SriLankaCalendar } from '../../utils/SriLankaCalendar.js';

// A hazard event (an incident): what UC03's coordination dashboard opens
// against while it is ACTIVE, and what UC04's post-event report is generated
// for once it is CLOSED. It groups the hazard alerts issued during it and
// affects one or more districts.
//
// Built from a HazardEvent document; nothing here knows about the database.
export class HazardEvent {
  #eventId;
  #name;
  #hazardType;
  #startDate;
  #endDate;
  #status;
  #districts;

  constructor({
    eventId,
    name,
    hazardType,
    startDate,
    endDate = null,
    status,
    districts = [],
  } = {}) {
    if (eventId === undefined || eventId === null) {
      throw new Error('HazardEvent needs an eventId');
    }
    this.#eventId = String(eventId);
    this.#name = name;
    this.#hazardType = hazardType;
    this.#startDate = new Date(startDate);
    this.#endDate = endDate === null ? null : new Date(endDate);
    this.#status = status;
    this.#districts = Object.freeze([...districts]);
  }

  /**
   * Maps a HazardEvent document (or its lean / toJSON form) onto the domain
   * class. districts may be ids or populated District documents.
   * @param {object} doc
   * @returns {HazardEvent}
   */
  static fromDocument(doc) {
    return new HazardEvent({ ...doc, eventId: doc._id ?? doc.id });
  }

  /** The event's id, as a string - the `id` the Hazard events endpoint returns. */
  get eventId() {
    return this.#eventId;
  }

  get name() {
    return this.#name;
  }

  get hazardType() {
    return this.#hazardType;
  }

  get startDate() {
    return this.#startDate;
  }

  /** null while the event is ACTIVE. */
  get endDate() {
    return this.#endDate;
  }

  get status() {
    return this.#status;
  }

  get districts() {
    return this.#districts;
  }

  /**
   * True once the event is over: UC04 reports only on a closed event.
   * @returns {boolean}
   */
  isClosed() {
    return this.#status === EventStatus.CLOSED;
  }

  /**
   * True when the date falls on a day of the event: from its start day to its
   * end day inclusive, counted in Sri Lanka calendar days. An ACTIVE event has
   * no end yet, so it covers every day from its start. A missing or invalid
   * date is covered by no event.
   * @param {Date|string|number} date
   * @returns {boolean}
   */
  covers(date) {
    const day = SriLankaCalendar.dayOf(date);
    if (day === null || day < SriLankaCalendar.dayOf(this.#startDate)) {
      return false;
    }
    return this.#endDate === null || day <= SriLankaCalendar.dayOf(this.#endDate);
  }
}
