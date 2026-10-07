import { AlertHazardType } from '../../enums/AlertHazardType.js';
import { SeverityLevel } from '../../enums/SeverityLevel.js';

// The preview message for a warning (step 7): one template per hazard type,
// with the severity in its wording, e.g. "Flood Warning: SEVERE. Move to
// higher ground and follow official guidance." Every type and severity fits
// in one SMS (160 characters); the officer may then edit it (step 8).
export class MessageTemplate {
  static MAX_LENGTH = 160;

  static #LABELS = Object.freeze({
    [AlertHazardType.FLOOD]: 'Flood',
    [AlertHazardType.LANDSLIDE]: 'Landslide',
    [AlertHazardType.CYCLONE]: 'Cyclone',
    [AlertHazardType.DROUGHT]: 'Drought',
  });

  // What to do, per type: urgent wording for HIGH and SEVERE, a prepare-and-
  // watch wording for LOW and MEDIUM.
  static #ADVICE = Object.freeze({
    [AlertHazardType.FLOOD]: {
      urgent: 'Move to higher ground and follow official guidance.',
      watch: 'Avoid riverbanks and low ground, and be ready to move to higher ground.',
    },
    [AlertHazardType.LANDSLIDE]: {
      urgent: 'Leave steep slopes now and move to a safe shelter.',
      watch: 'Watch slopes for cracks or falling rocks, and be ready to leave.',
    },
    [AlertHazardType.CYCLONE]: {
      urgent: 'Stay indoors away from windows, or move to the nearest shelter.',
      watch: 'Secure loose objects and keep water, food and a torch ready.',
    },
    [AlertHazardType.DROUGHT]: {
      urgent: 'Use water only for essential needs and follow official water guidance.',
      watch: 'Save water where you can and follow official water guidance.',
    },
  });

  static #URGENT = [SeverityLevel.HIGH, SeverityLevel.SEVERE];

  /**
   * The short heading for a warning, e.g. "Flood Warning: SEVERE": the inbox
   * item's title on the citizen's phone.
   * @param {string} hazardType An AlertHazardType.
   * @param {string} severity A SeverityLevel.
   * @returns {string}
   */
  static title(hazardType, severity) {
    return `${MessageTemplate.#label(hazardType)} Warning: ${severity}`;
  }

  /**
   * The message for a hazard type and severity, at most 160 characters.
   * @param {string} hazardType An AlertHazardType.
   * @param {string} severity A SeverityLevel.
   * @returns {string}
   */
  static generate(hazardType, severity) {
    const action = MessageTemplate.#advice(hazardType, severity);
    return `${MessageTemplate.title(hazardType, severity)}. ${action}`;
  }

  /**
   * The message for an update to an active warning (A2.3), e.g. "UPDATE: Flood
   * Warning now SEVERE. Move to higher ground and follow official guidance.",
   * at most 160 characters. The officer may edit it before confirming.
   * @param {string} hazardType An AlertHazardType.
   * @param {string} severity The new SeverityLevel.
   * @returns {string}
   */
  static update(hazardType, severity) {
    const action = MessageTemplate.#advice(hazardType, severity);
    return `UPDATE: ${MessageTemplate.#label(hazardType)} Warning now ${severity}. ${action}`;
  }

  /**
   * The inbox heading for an all-clear (A3.2), e.g. "Flood Warning: ALL CLEAR".
   * @param {string} hazardType An AlertHazardType.
   * @returns {string}
   */
  static allClearTitle(hazardType) {
    return `${MessageTemplate.#label(hazardType)} Warning: ALL CLEAR`;
  }

  /**
   * The all-clear message (A3.2), e.g. "ALL CLEAR: The Flood warning has
   * ended. It is now safe, but follow official guidance.", at most 160
   * characters. It isn't editable: the officer only confirms it.
   * @param {string} hazardType An AlertHazardType.
   * @returns {string}
   */
  static allClear(hazardType) {
    return `ALL CLEAR: The ${MessageTemplate.#label(hazardType)} warning has ended. It is now safe, but follow official guidance.`;
  }

  static #label(hazardType) {
    const label = MessageTemplate.#LABELS[hazardType];
    if (!label) {
      throw new Error(`MessageTemplate: unknown hazard type "${hazardType}"`);
    }
    return label;
  }

  // What to do for the type: the urgent or the prepare-and-watch wording.
  // Refuses an unknown severity or type.
  static #advice(hazardType, severity) {
    if (!Object.values(SeverityLevel).includes(severity)) {
      throw new Error(`MessageTemplate: unknown severity "${severity}"`);
    }
    MessageTemplate.#label(hazardType);
    const advice = MessageTemplate.#ADVICE[hazardType];
    return MessageTemplate.#URGENT.includes(severity) ? advice.urgent : advice.watch;
  }
}
