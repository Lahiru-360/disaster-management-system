import { EventStatus } from '../../../src/enums/EventStatus.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { ActiveIncident } from '../../../src/services/ActiveIncident.js';
import { seedAreas } from '../../helpers/areaFixtures.js';

let areas;

beforeEach(async () => {
  areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
});

describe('ActiveIncident', () => {
  it("Main 1: finds the district's ACTIVE event and ignores CLOSED ones", async () => {
    const incidents = new ActiveIncident();
    await HazardEvent.create({
      name: 'Old Colombo flood',
      hazardType: 'FLOOD',
      status: EventStatus.CLOSED,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-10'),
      districts: [areas.colombo._id],
    });

    expect((await incidents.find(areas.gampaha._id)).name).toBe('Flood – Gampaha');
    expect(await incidents.find(areas.colombo._id)).toBeNull();
  });

  it('Main 1: require() returns the incident, or refuses with 409 NO_ACTIVE_INCIDENT', async () => {
    const incidents = new ActiveIncident();

    expect((await incidents.require(areas.gampaha._id)).name).toBe('Flood – Gampaha');
    await expect(incidents.require(areas.colombo._id)).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_INCIDENT',
    });
  });
});
