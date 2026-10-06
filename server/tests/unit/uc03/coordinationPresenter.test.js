import mongoose from 'mongoose';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';
import { CoordinationPresenter } from '../../../src/services/CoordinationPresenter.js';

const id = () => new mongoose.Types.ObjectId();

describe('CoordinationPresenter.reference', () => {
  it('Main 2: gives { id, ...fields } for a populated document', () => {
    const district = { _id: id(), name: 'Gampaha' };

    expect(CoordinationPresenter.reference(district, ['name'])).toEqual({
      id: String(district._id),
      name: 'Gampaha',
    });
  });

  it('Main 2: gives the hex id, not raw bytes, for an unpopulated ObjectId', () => {
    const districtId = id();

    expect(CoordinationPresenter.reference(districtId, [])).toEqual({
      id: districtId.toHexString(),
    });
  });

  it('Main 2: keeps a string id as it is', () => {
    expect(CoordinationPresenter.reference('66f7c1a2b3c4d5e6f7a8b902', [])).toEqual({
      id: '66f7c1a2b3c4d5e6f7a8b902',
    });
  });

  it.each([null, undefined])('Main 2: gives null for a missing reference (%p)', (missing) => {
    expect(CoordinationPresenter.reference(missing, ['name'])).toBeNull();
  });
});

describe('CoordinationPresenter.team', () => {
  it('Main 7: shows a team with no lead and unpopulated references', () => {
    const doc = new RescueTeam({
      name: 'Team Echo',
      organisation: id(),
      district: id(),
      memberCount: 6,
      baseLocation: { lat: 7.1, lng: 80 },
      currentLocation: { lat: 7.1, lng: 80 },
    });

    const team = CoordinationPresenter.team(doc);

    expect(team.lead).toBeNull();
    expect(team.organisation).toEqual({ id: String(doc.organisation) });
    expect(team.baseLocation).toEqual({ lat: 7.1, lng: 80, label: null });
    expect(team.currentTask).toBeNull();
  });

  it('Main 7: passes the current task through when one is given', () => {
    const doc = new RescueTeam({ name: 'Team Alpha', memberCount: 8 });
    const currentTask = { dispatchId: 'd1', status: 'ASSIGNED' };

    expect(CoordinationPresenter.team(doc, currentTask).currentTask).toBe(currentTask);
    expect(CoordinationPresenter.team(doc).baseLocation).toBeNull();
  });
});

describe('CoordinationPresenter.distribution', () => {
  it('Main 13: has no unit when the stock row is not populated', () => {
    const doc = new SupplyDistribution({
      shelter: id(),
      stock: id(),
      organisation: id(),
      supplyType: SupplyType.WATER,
      district: id(),
      quantity: 5,
      distributedAt: new Date('2026-10-03T10:00:00.000Z'),
      loggedBy: id(),
    });

    const distribution = CoordinationPresenter.distribution(doc);

    expect(distribution.unit).toBeNull();
    expect(distribution.stockId).toBe(String(doc.stock));
  });
});
