import { MessageTemplate } from '../src/domain/alerts/MessageTemplate.js';
import { AlertHazardType } from '../src/enums/AlertHazardType.js';
import { SeverityLevel } from '../src/enums/SeverityLevel.js';
import { HazardAlert } from '../src/models/HazardAlert.js';
import { Seeder } from './Seeder.js';

// UC01 demo data. The demo starts with no hazard alerts: the officer issues
// the first warning live, from the seeded citizens (PeopleSeeder) and areas
// (DistrictSeeder). Alerts made in a rehearsal are demo data, so
// `--reset-demo` empties them for the next run.
//
// It also checks every preview message (4 hazard types × 4 severities) fits
// in one SMS, so a template edit that breaks the 160-character rule fails the
// seed instead of the demo. Expects an open connection - DatabaseSeeder owns
// it (`npm run seed -- --only=uc01` runs just this one).
export class Uc01Seeder extends Seeder {
  #messageTemplate;

  constructor({ messageTemplate = MessageTemplate } = {}) {
    super();
    this.#messageTemplate = messageTemplate;
  }

  get demoModels() {
    return [HazardAlert];
  }

  async run() {
    this.#checkMessageTemplates();
  }

  #checkMessageTemplates() {
    const tooLong = Object.values(AlertHazardType).flatMap((type) =>
      Object.values(SeverityLevel)
        .map((severity) => ({
          type,
          severity,
          message: this.#messageTemplate.generate(type, severity),
        }))
        .filter(({ message }) => message.length > MessageTemplate.MAX_LENGTH),
    );
    if (tooLong.length > 0) {
      const names = tooLong.map(({ type, severity }) => `${type}/${severity}`).join(', ');
      throw new Error(
        `Uc01Seeder: preview messages over ${MessageTemplate.MAX_LENGTH} characters: ${names}`,
      );
    }
  }
}
