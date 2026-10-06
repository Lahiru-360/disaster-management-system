import { ReportSectionKey } from '../../../enums/ReportSectionKey.js';
import { SupplyType } from '../../../enums/SupplyType.js';
import { ReportNames } from '../ReportNames.js';
import { SupplyDistributionRepository } from '../repositories/SupplyDistributionRepository.js';
import { ReportSection } from '../ReportSection.js';

// UC04 step 9: where relief supplies went, and whose they were, as totals by
// district x supply type x owning organisation. Quantities are summed in each
// stock row's own unit, since the distribution record doesn't carry it.
export class ResourceDistributionSection extends ReportSection {
  static #SUPPLY_TYPE_ORDER = Object.values(SupplyType);

  #distributions;
  #names;

  constructor({
    distributions = new SupplyDistributionRepository(),
    names = new ReportNames(),
  } = {}) {
    super();
    this.#distributions = distributions;
    this.#names = names;
  }

  get key() {
    return ReportSectionKey.RESOURCE_DISTRIBUTION;
  }

  get gapReason() {
    return 'No distribution records';
  }

  /**
   * @param {import('../../../domain/analysis/ReportContext.js').ReportContext} ctx
   * @returns {Promise<{ result: object, isEmpty: boolean, gaps: import('../../../domain/analysis/DataGap.js').DataGap[] }>}
   */
  async compile(ctx) {
    const { start, end } = ctx.instants();
    const records = (
      await this.#distributions.findInRange({ districtIds: ctx.districtIds, start, end })
    ).filter((record) => ctx.includesDistrict(record.district));

    const [districtNames, organisationNames] = await Promise.all([
      this.#names.districts(ctx.districtIds),
      this.#names.organisations(records.map((record) => record.organisation)),
    ]);

    const groups = new Map();
    const perDay = new Map();
    records.forEach((record) => {
      const key = [record.district, record.supplyType, record.organisation].join('|');
      const group = groups.get(key) ?? {
        district: districtNames.get(record.district),
        supplyType: record.supplyType,
        organisation: organisationNames.get(record.organisation),
        quantity: 0,
      };
      group.quantity += record.quantity;
      groups.set(key, group);

      const day = ctx.dayOf(record.distributedAt);
      perDay.set(day, (perDay.get(day) ?? 0) + record.quantity);
    });

    const rows = [...groups.values()].sort(ResourceDistributionSection.#rowOrder);
    return {
      result: {
        rows,
        total: rows.reduce((sum, row) => sum + row.quantity, 0),
        days: ctx.days().map((date) => ({ date, quantity: perDay.get(date) ?? null })),
      },
      isEmpty: records.length === 0,
      gaps: this.findGaps(ctx, perDay.keys()),
    };
  }

  // By district name, then supply type in SupplyType order, then organisation name.
  static #rowOrder(a, b) {
    const typeRank = (type) => {
      const rank = ResourceDistributionSection.#SUPPLY_TYPE_ORDER.indexOf(type);
      return rank === -1 ? ResourceDistributionSection.#SUPPLY_TYPE_ORDER.length : rank;
    };
    return (
      (a.district.name ?? '').localeCompare(b.district.name ?? '') ||
      typeRank(a.supplyType) - typeRank(b.supplyType) ||
      (a.organisation.name ?? '').localeCompare(b.organisation.name ?? '')
    );
  }
}
