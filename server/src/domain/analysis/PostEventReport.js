import { DataGap } from './DataGap.js';

// A post-event analysis report (UC04): about one CLOSED hazard event, generated
// by a DMC officer, covering an inclusive range of Sri Lanka calendar days.
// Sections are added one at a time as each ReportSection compiles, and every
// gap a section found is kept with the report, so partial figures are never
// mistaken for complete ones.
//
// Built from a PostEventReport document, or by the report builder before the
// report is stored (reportId null); nothing here knows about the database.
export class PostEventReport {
  #reportId;
  #eventId;
  #generatedBy;
  #generatedAt;
  #dateFrom;
  #dateTo;
  #districts;
  #sections = [];
  #gaps = [];

  constructor({
    reportId = null,
    eventId,
    generatedBy,
    generatedAt,
    dateFrom,
    dateTo,
    districts = [],
    sections = [],
    gaps = [],
  } = {}) {
    if (eventId === undefined || eventId === null) {
      throw new Error('PostEventReport needs an eventId');
    }
    this.#reportId = reportId === null ? null : String(reportId);
    this.#eventId = String(eventId);
    this.#generatedBy = generatedBy;
    this.#generatedAt = new Date(generatedAt);
    this.#dateFrom = dateFrom;
    this.#dateTo = dateTo;
    this.#districts = Object.freeze([...districts]);
    sections.forEach(({ key, result }) => this.addSection({ key, result }));
    this.#gaps.push(...gaps.map((gap) => (gap instanceof DataGap ? gap : new DataGap(gap))));
  }

  /**
   * Maps a PostEventReport document (or its lean / toJSON form) onto the
   * domain class. event may be an id or a populated HazardEvent document.
   * @param {object} doc
   * @returns {PostEventReport}
   */
  static fromDocument(doc) {
    const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    // A populated event carries its name; an ObjectId's own .id is its bytes.
    const { event } = plain;
    const eventId =
      event && typeof event === 'object' && 'name' in event ? (event._id ?? event.id) : event;
    return new PostEventReport({ ...plain, reportId: plain._id ?? plain.id, eventId });
  }

  /** The stored report's id, or null before the report is stored. */
  get reportId() {
    return this.#reportId;
  }

  get eventId() {
    return this.#eventId;
  }

  get generatedBy() {
    return this.#generatedBy;
  }

  get generatedAt() {
    return this.#generatedAt;
  }

  get dateFrom() {
    return this.#dateFrom;
  }

  get dateTo() {
    return this.#dateTo;
  }

  get districts() {
    return this.#districts;
  }

  /** The compiled sections, `{ key, result }`, in the order they were added. */
  get sections() {
    return Object.freeze([...this.#sections]);
  }

  /** Every gap of every section, in the order they were added. */
  get gaps() {
    return Object.freeze([...this.#gaps]);
  }

  /**
   * Adds one compiled section and the gaps it found. Each gap must belong to
   * the section it is added with, and a section can be added only once.
   * @param {{ key: string, result: object, gaps?: Array<DataGap|object> }} section
   * @returns {PostEventReport} this report, so additions can be chained
   */
  addSection({ key, result, gaps = [] }) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error(`A report section needs a key, got ${key}`);
    }
    if (this.#sections.some((section) => section.key === key)) {
      throw new Error(`Report section added twice: ${key}`);
    }
    if (result === undefined || result === null) {
      throw new Error(`Report section ${key} has no result`);
    }
    const sectionGaps = gaps.map((gap) => (gap instanceof DataGap ? gap : new DataGap(gap)));
    if (sectionGaps.some((gap) => gap.section !== key)) {
      throw new Error(`A gap added with section ${key} belongs to another section`);
    }
    this.#sections.push(Object.freeze({ key, result }));
    this.#gaps.push(...sectionGaps);
    return this;
  }

  /**
   * True when any section has days with no records: the report view then
   * shows the incomplete-data banner.
   * @returns {boolean}
   */
  hasGaps() {
    return this.#gaps.length > 0;
  }
}
