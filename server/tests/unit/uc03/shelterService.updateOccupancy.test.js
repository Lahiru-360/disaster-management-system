import { EventStatus } from '../../../src/enums/EventStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../../src/models/OccupancyRecord.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { ActiveIncident } from '../../../src/services/ActiveIncident.js';
import { ShelterService } from '../../../src/services/ShelterService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-03T09:30:00.000Z';

let areas;
let officer;
let shelter;
let clock;
let service;

const activeEvent = (district) =>
  HazardEvent.create({
    name: `Flood – ${district.name}`,
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [district._id],
  });

beforeEach(async () => {
  areas = await seedAreas();
  await activeEvent(areas.gampaha);
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  shelter = await Shelter.create({
    district: areas.gampaha._id,
    name: 'Gampaha Central College',
    location: { lat: 7.09, lng: 79.99 },
    capacity: 500,
    currentOccupancy: 380,
  });
  clock = new FakeClock(NOW);
  service = new ShelterService({ clock });
});

describe('ShelterService.updateOccupancy', () => {
  it('TC-07: Main 3-4 sets the occupancy and keeps an occupancy record', async () => {
    await service.updateOccupancy(officer, shelter.id, { occupants: 460 });

    expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(460);
    const records = await OccupancyRecord.find();
    expect(records).toHaveLength(1);
    expect(records[0].toObject()).toMatchObject({
      shelter: shelter._id,
      district: areas.gampaha._id,
      occupants: 460,
      capacity: 500,
      recordedAt: new Date(NOW),
      recordedBy: officer._id,
    });
  });

  it('Main 5: answers with the shelter, its new rate and status, flagged at NEAR_CAPACITY', async () => {
    const result = await service.updateOccupancy(officer, shelter.id, { occupants: 460 });

    expect(result).toMatchObject({
      rate: 0.92,
      status: ShelterStatus.NEAR_CAPACITY,
      flagged: true,
      alternateShelter: null,
      dmcAlerted: false,
      shelter: {
        id: shelter.id,
        name: 'Gampaha Central College',
        district: { id: areas.gampaha.id, name: 'Gampaha' },
        currentOccupancy: 460,
        rate: 0.92,
        status: ShelterStatus.NEAR_CAPACITY,
      },
    });
  });

  it.each([
    [374, ShelterStatus.AVAILABLE, false],
    [375, ShelterStatus.FILLING_UP, false],
    [500, ShelterStatus.FULL, true],
    [505, ShelterStatus.FULL, true],
  ])('Main 5: %d of 500 is %s, flagged: %s', async (occupants, status, flagged) => {
    const result = await service.updateOccupancy(officer, shelter.id, { occupants });

    expect(result).toMatchObject({ status, flagged });
  });

  it('TC-14: 0 occupants is saved as an empty, AVAILABLE shelter', async () => {
    const result = await service.updateOccupancy(officer, shelter.id, { occupants: 0 });

    expect(result).toMatchObject({ rate: 0, status: ShelterStatus.AVAILABLE, flagged: false });
    expect(await OccupancyRecord.countDocuments({ occupants: 0 })).toBe(1);
  });

  it('Main 4: every update adds its own record, stamped by the clock', async () => {
    await service.updateOccupancy(officer, shelter.id, { occupants: 400 });
    clock.advance(10 * FakeClock.MINUTE);
    await service.updateOccupancy(officer, shelter.id, { occupants: 420 });

    const records = await OccupancyRecord.find().sort({ recordedAt: 1 });
    expect(records.map((r) => [r.occupants, r.recordedAt.toISOString()])).toEqual([
      [400, NOW],
      [420, '2026-10-03T09:40:00.000Z'],
    ]);
  });

  it('TC-46: E1 a refused value changes nothing and records nothing', async () => {
    await expect(service.updateOccupancy(officer, shelter.id, { occupants: -1 })).rejects.toThrow(
      'Shelter occupancy must be a whole number, 0 or more',
    );

    expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(380);
    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });

  it('TC-29: a shelter in another district is refused with 403 and left alone', async () => {
    const colomboOfficer = await createUser({
      role: Role.DISTRICT_OFFICER,
      district: areas.colombo,
    });

    await expect(
      service.updateOccupancy(colomboOfficer, shelter.id, { occupants: 10 }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });

  it('Main 3: an unknown or malformed shelter id is 404', async () => {
    await expect(
      service.updateOccupancy(officer, '66fb0a1b2c3d4e5f6a7b8c99', { occupants: 10 }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Shelter not found.' });
    await expect(
      service.updateOccupancy(officer, 'not-an-id-12', { occupants: 10 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('Main 3: with no ACTIVE incident nothing is changed: 409 NO_ACTIVE_INCIDENT', async () => {
    await HazardEvent.deleteMany({});

    await expect(
      service.updateOccupancy(officer, shelter.id, { occupants: 460 }),
    ).rejects.toMatchObject({ status: 409, code: 'NO_ACTIVE_INCIDENT' });
    expect((await Shelter.findById(shelter._id)).currentOccupancy).toBe(380);
    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });
});

describe('ActiveIncident', () => {
  it('Main 1: finds the district’s ACTIVE event, newest first, and ignores CLOSED ones', async () => {
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
    await expect(incidents.require(areas.colombo._id)).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_INCIDENT',
    });
    expect((await incidents.require(areas.gampaha._id)).name).toBe('Flood – Gampaha');
  });
});
