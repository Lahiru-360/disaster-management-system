import { jest } from '@jest/globals';
import { ResourceDistributionSection } from '../../../src/services/reports/sections/ResourceDistributionSection.js';
import { D, at, fakeNames, kelaniContext, onDay } from './reportFixtures.js';

const ORGANISATIONS = {
  'o-rc': { name: 'Red Cross Sri Lanka', type: 'NGO' },
  'o-un': { name: 'UNICEF Sri Lanka', type: 'DONOR' },
  'o-ad': { name: 'ADRA', type: 'NGO' },
};

const distribution = (district, supplyType, organisation, quantity, distributedAt = at(10)) => ({
  district,
  supplyType,
  organisation,
  quantity,
  distributedAt,
});

const sectionWith = (records) => {
  const repository = { findInRange: jest.fn(async () => records) };
  return {
    section: new ResourceDistributionSection({
      distributions: repository,
      names: fakeNames(ORGANISATIONS),
    }),
    repository,
  };
};

describe('ResourceDistributionSection', () => {
  it('DMS-153.3: is the resourceDistribution section, with "No distribution records" gaps', () => {
    const { section } = sectionWith([]);
    expect([section.key, section.gapReason]).toEqual([
      'resourceDistribution',
      'No distribution records',
    ]);
  });

  it("DMS-153.3: reads the selected districts' distributions inside the range", async () => {
    const ctx = kelaniContext({ districtIds: [D.colombo] });
    const { section, repository } = sectionWith([]);

    await section.compile(ctx);

    expect(repository.findInRange).toHaveBeenCalledWith({
      districtIds: [D.colombo],
      ...ctx.instants(),
      organisationId: null,
    });
  });

  it('TC-12 Main 9: totals the quantities by district x supply type x organisation', async () => {
    const { section } = sectionWith([
      distribution(D.gampaha, 'WATER', 'o-rc', 500),
      distribution(D.gampaha, 'WATER', 'o-rc', 250, at(11)),
      distribution(D.gampaha, 'WATER', 'o-un', 100),
      distribution(D.gampaha, 'FOOD', 'o-rc', 40),
      distribution(D.colombo, 'WATER', 'o-rc', 60),
    ]);

    const { result, isEmpty } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(false);
    expect(result.rows).toEqual([
      {
        district: { id: D.colombo, name: 'Colombo' },
        supplyType: 'WATER',
        organisation: { id: 'o-rc', name: 'Red Cross Sri Lanka', type: 'NGO' },
        quantity: 60,
      },
      {
        district: { id: D.gampaha, name: 'Gampaha' },
        supplyType: 'FOOD',
        organisation: { id: 'o-rc', name: 'Red Cross Sri Lanka', type: 'NGO' },
        quantity: 40,
      },
      {
        district: { id: D.gampaha, name: 'Gampaha' },
        supplyType: 'WATER',
        organisation: { id: 'o-rc', name: 'Red Cross Sri Lanka', type: 'NGO' },
        quantity: 750,
      },
      {
        district: { id: D.gampaha, name: 'Gampaha' },
        supplyType: 'WATER',
        organisation: { id: 'o-un', name: 'UNICEF Sri Lanka', type: 'DONOR' },
        quantity: 100,
      },
    ]);
    expect(result.total).toBe(950);
  });

  it('DMS-153.3: sorts rows by district name, supply type order, then organisation name', async () => {
    const { section } = sectionWith([
      distribution(D.kalutara, 'HYGIENE_KITS', 'o-un', 1),
      distribution(D.kalutara, 'GENERATORS', 'o-ad', 1),
      distribution(D.kalutara, 'BLANKETS', 'o-un', 1),
      distribution(D.kalutara, 'BLANKETS', 'o-ad', 1),
      distribution(D.colombo, 'MEDICINE', 'o-rc', 1),
    ]);

    const { result } = await section.compile(kelaniContext());

    expect(
      result.rows.map((row) => [row.district.name, row.supplyType, row.organisation.name]),
    ).toEqual([
      ['Colombo', 'MEDICINE', 'Red Cross Sri Lanka'],
      ['Kalutara', 'BLANKETS', 'ADRA'],
      ['Kalutara', 'BLANKETS', 'UNICEF Sri Lanka'],
      ['Kalutara', 'HYGIENE_KITS', 'UNICEF Sri Lanka'],
      // A type outside SupplyType goes last.
      ['Kalutara', 'GENERATORS', 'ADRA'],
    ]);
  });

  it('DMS-153.3: an organisation that no longer exists keeps its id, with a null name', async () => {
    const { section } = sectionWith([
      distribution(D.colombo, 'FOOD', 'o-gone', 5),
      distribution(D.colombo, 'FOOD', 'o-rc', 5),
    ]);

    const { result } = await section.compile(kelaniContext());

    expect(result.rows.map((row) => row.organisation)).toEqual([
      { id: 'o-gone', name: null, type: null },
      { id: 'o-rc', name: 'Red Cross Sri Lanka', type: 'NGO' },
    ]);
  });

  it('DMS-153.3: totals the quantity per day, with null on days without records, and marks them as gaps', async () => {
    const { section } = sectionWith([
      distribution(D.colombo, 'FOOD', 'o-rc', 30, at(8)),
      distribution(D.gampaha, 'WATER', 'o-rc', 70, at(8, '23:30')),
      distribution(D.gampaha, 'WATER', 'o-rc', 15, at(10)),
    ]);

    const { result, gaps } = await section.compile(
      kelaniContext({ dateFrom: '2026-06-08', dateTo: '2026-06-10' }),
    );

    expect(result.days).toEqual([
      { date: '2026-06-08', quantity: 100 },
      { date: '2026-06-09', quantity: null },
      { date: '2026-06-10', quantity: 15 },
    ]);
    expect(onDay(result.days, '2026-06-09', 'quantity')).toBeNull();
    expect(gaps.map((gap) => gap.toJSON())).toEqual([
      {
        section: 'resourceDistribution',
        from: '2026-06-09',
        to: '2026-06-09',
        reason: 'No distribution records',
      },
    ]);
  });

  it('DMS-153.3: ignores a distribution to a district that was not selected', async () => {
    const { section } = sectionWith([distribution(D.kalutara, 'FOOD', 'o-rc', 30)]);

    const { result, isEmpty } = await section.compile(kelaniContext({ districtIds: [D.colombo] }));

    expect(result.rows).toEqual([]);
    expect(isEmpty).toBe(true);
  });

  it('DMS-153.3: no distributions is an empty section with a zero total', async () => {
    const { section } = sectionWith([]);

    const { result, isEmpty, gaps } = await section.compile(kelaniContext());

    expect(isEmpty).toBe(true);
    expect(result.total).toBe(0);
    expect(gaps).toHaveLength(1);
  });
});
