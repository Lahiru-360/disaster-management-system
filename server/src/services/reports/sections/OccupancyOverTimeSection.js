import { ReportSectionKey } from '../../../enums/ReportSectionKey.js';
import { ReportNames } from '../ReportNames.js';
import { OccupancyRecordRepository } from '../repositories/OccupancyRecordRepository.js';
import { ReportSection } from '../ReportSection.js';

// UC04 step 8: how full each district's shelters got, as a daily peak.
//
// At each moment a record was saved, a district's occupancy is the sum of its
// shelters' latest occupants (a record from before the range gives a shelter's
// starting value). A day's peak is the highest of those sums that day, not the
// last one. A district with no record on a day has no value that day: nothing
// is carried over into a day without records (§14.2).
export class OccupancyOverTimeSection extends ReportSection {
  #occupancy;
  #names;

  constructor({ occupancy = new OccupancyRecordRepository(), names = new ReportNames() } = {}) {
    super();
    this.#occupancy = occupancy;
    this.#names = names;
  }

  get key() {
    return ReportSectionKey.OCCUPANCY_OVER_TIME;
  }

  get gapReason() {
    return 'No occupancy records';
  }

  /**
   * The highest daily total: a day's total is the sum of the districts'
   * peaks that day. Days without any record don't count, and a tie goes to
   * the earlier day.
   * @param {{ districts: Array<{ days: Array<{ date: string, peak: number|null }> }> }} result
   * @returns {{ peakOccupancy: number|null, peakOccupancyDate: string|null }}
   */
  summarise(result) {
    const totals = new Map();
    result.districts.forEach((row) =>
      row.days
        .filter((day) => day.peak !== null)
        .forEach((day) => totals.set(day.date, (totals.get(day.date) ?? 0) + day.peak)),
    );
    let best = { peakOccupancy: null, peakOccupancyDate: null };
    [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, total]) => {
        if (best.peakOccupancy === null || total > best.peakOccupancy) {
          best = { peakOccupancy: total, peakOccupancyDate: date };
        }
      });
    return best;
  }

  /**
   * @param {import('../../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @returns {Promise<{ result: object, isEmpty: boolean, gaps: import('../../../domain/analysis/DataGap.js').DataGap[] }>}
   */
  async compile(ctx) {
    const { start, end } = ctx.instants();
    const { districtIds } = ctx;
    const [before, inRange, names] = await Promise.all([
      this.#occupancy.findLatestBefore({ districtIds, start }),
      this.#occupancy.findInRange({ districtIds, start, end }),
      this.#names.districts(districtIds),
    ]);

    // district -> shelter -> latest occupants, and district -> day -> peak.
    const latest = new Map(districtIds.map((id) => [id, new Map()]));
    const peaks = new Map(districtIds.map((id) => [id, new Map()]));
    before
      .filter((record) => latest.has(record.district))
      .forEach((record) => latest.get(record.district).set(record.shelter, record.occupants));

    OccupancyOverTimeSection.#byMoment(
      inRange.filter((record) => latest.has(record.district)),
    ).forEach((records) => {
      records.forEach((record) =>
        latest.get(record.district).set(record.shelter, record.occupants),
      );
      const day = ctx.dayOf(records[0].recordedAt);
      new Set(records.map((record) => record.district)).forEach((district) => {
        const total = [...latest.get(district).values()].reduce((sum, value) => sum + value, 0);
        const dayPeaks = peaks.get(district);
        dayPeaks.set(day, Math.max(dayPeaks.get(day) ?? 0, total));
      });
    });

    const days = ctx.days();
    const recordDays = new Set();
    const districts = districtIds.map((id) => {
      const dayPeaks = peaks.get(id);
      dayPeaks.forEach((_peak, day) => recordDays.add(day));
      let peak = null;
      days.forEach((day) => {
        if (dayPeaks.has(day) && (peak === null || dayPeaks.get(day) > peak.value)) {
          peak = { value: dayPeaks.get(day), date: day };
        }
      });
      return {
        district: names.get(id),
        days: days.map((date) => ({ date, peak: dayPeaks.get(date) ?? null })),
        peak,
      };
    });

    return {
      result: { districts },
      isEmpty: recordDays.size === 0,
      gaps: this.findGaps(ctx, recordDays),
    };
  }

  // The in-range records grouped by the exact moment they were saved, oldest
  // first, so updates saved together are applied together before summing.
  static #byMoment(records) {
    const moments = new Map();
    records.forEach((record) => {
      const time = new Date(record.recordedAt).getTime();
      moments.set(time, [...(moments.get(time) ?? []), record]);
    });
    return [...moments.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
  }
}
