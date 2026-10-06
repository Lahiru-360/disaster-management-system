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
   * The message for a hazard type and severity, at most 160 characters.
   * @param {string} hazardType An AlertHazardType.
   * @param {string} severity A SeverityLevel.
   * @returns {string}
   */
  static generate(hazardType, severity) {
    const label = MessageTemplate.#LABELS[hazardType];
    if (!label) {
      throw new Error(`MessageTemplate: unknown hazard type "${hazardType}"`);
    }
    if (!Object.values(SeverityLevel).includes(severity)) {
      throw new Error(`MessageTemplate: unknown severity "${severity}"`);
    }
    const advice = MessageTemplate.#ADVICE[hazardType];
    const action = MessageTemplate.#URGENT.includes(severity) ? advice.urgent : advice.watch;
    return `${label} Warning: ${severity}. ${action}`;
  }
}
