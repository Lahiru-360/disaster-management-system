import { SriLankaCalendar } from '../../utils/SriLankaCalendar.js';

// UC04 E1 (step 5): whether a report's range and districts make sense for its
// event. The request's shape is checked before this runs (Joi); these checks
// need the event, so they run once it has been loaded. Pure: no database.
export class ReportParameters {
  /**
   * The field errors in the requested range and districts, one per field, in
   * the contract's `{ field, message }` form (§14.3). Empty when all is well.
   * The range must sit inside the event's period, counted in Sri Lanka days,
   * and start no later than it ends; one day (from = to) is a valid range.
   * Every district must be one the event affected.
   * @param {import('../events/HazardEvent.js').HazardEvent} event a CLOSED event
   * @param {{ from: string, to: string, districtIds: string[] }} params "YYYY-MM-DD" days
   * @returns {Array<{ field: string, message: string }>}
   */
  static problemsWith(event, { from, to, districtIds }) {
    const start = SriLankaCalendar.dayOf(event.startDate);
    const end = SriLankaCalendar.dayOf(event.endDate);
    const problems = [];

    if (from > to) {
      problems.push({ field: 'from', message: 'must not be after to' });
    } else if (from < start) {
      problems.push({
        field: 'from',
        message: `must be on or after the event start date ${start}`,
      });
    }
    if (end !== null && to > end) {
      problems.push({ field: 'to', message: `must be on or before the event end date ${end}` });
    }

    const affected = new Set(event.districts.map(String));
    if (districtIds.some((id) => !affected.has(String(id)))) {
      problems.push({ field: 'districtIds', message: 'must be a district the event affected' });
    }
    return problems;
  }
}
