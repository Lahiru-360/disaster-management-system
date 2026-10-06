import { TeamStatus } from '../../enums/TeamStatus.js';

// A rescue team an Organisation owns (UC03), dispatched to incidents in its
// district.
//
// Built from a RescueTeam document; nothing here knows about the database.
export class RescueTeam {
  #teamId;
  #name;
  #organisation;
  #district;
  #memberCount;
  #lead;
  #currentLocation;
  #status;

  constructor({
    teamId,
    name,
    organisation,
    district,
    memberCount,
    lead = null,
    currentLocation,
    status,
  } = {}) {
    if (teamId === undefined || teamId === null) {
      throw new Error('RescueTeam needs a teamId');
    }
    if (!Object.values(TeamStatus).includes(status)) {
      throw new Error(`Unknown team status: ${status}`);
    }
    this.#teamId = String(teamId);
    this.#name = name;
    this.#organisation = organisation;
    this.#district = district;
    this.#memberCount = memberCount;
    this.#lead = lead;
    this.#currentLocation = currentLocation ? Object.freeze({ ...currentLocation }) : undefined;
    this.#status = status;
  }

  /**
   * Maps a RescueTeam document (hydrated, lean or toJSON form) onto the domain
   * class. organisation, district and lead may be ids or populated documents.
   * @param {object} doc
   * @returns {RescueTeam}
   */
  static fromDocument(doc) {
    const fields = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    return new RescueTeam({ ...fields, teamId: fields._id ?? fields.id });
  }

  /** The team's id, as a string. */
  get teamId() {
    return this.#teamId;
  }

  get name() {
    return this.#name;
  }

  /** The owning organisation: its id, or a populated Organisation document. */
  get organisation() {
    return this.#organisation;
  }

  get district() {
    return this.#district;
  }

  get memberCount() {
    return this.#memberCount;
  }

  /** The lead's user id or document, or null when the team has no lead yet. */
  get lead() {
    return this.#lead;
  }

  /** { lat, lng, label }: where distances to an incident are measured from. */
  get currentLocation() {
    return this.#currentLocation;
  }

  get status() {
    return this.#status;
  }

  /**
   * True when the team can take a new dispatch: UC03 step 7 lists only these.
   * @returns {boolean}
   */
  isAvailable() {
    return this.#status === TeamStatus.AVAILABLE;
  }
}
