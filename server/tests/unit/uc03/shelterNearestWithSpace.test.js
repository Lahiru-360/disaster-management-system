import { Shelter as ShelterDomain } from '../../../src/domain/coordination/Shelter.js';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { ShelterService } from '../../../src/services/ShelterService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

// UC03 A2.2 (DMS-145.2): the nearest shelter that can still take people.
const domain = (capacity, currentOccupancy) =>
  new ShelterDomain({ shelterId: 's1', capacity, currentOccupancy });

describe('Shelter.hasSpareCapacity', () => {
  it.each([
    [0, true],
    [74, true],
    [75, true],
    [89, true],
    [90, false],
    [99, false],
    [100, false],
    [105, false],
  ])('%i of 100 -> %p (AVAILABLE or FILLING_UP only, below 90%)', (occupants, expected) => {
    expect(domain(100, occupants).hasSpareCapacity()).toBe(expected);
  });

  it('uses the exact ratio: 449 of 500 (89.8%) still has space, 450 does not', () => {
    expect(domain(500, 449).hasSpareCapacity()).toBe(true);
    expect(domain(500, 450).hasSpareCapacity()).toBe(false);
  });
});

let areas;
let officer;
let service;

const make = (district, name, lat, lng, capacity, currentOccupancy) =>
  Shelter.create({
    district: district._id,
    name,
    location: { lat, lng },
    capacity,
    currentOccupancy,
  });

beforeEach(async () => {
  areas = await seedAreas();
  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  service = new ShelterService();
});

const near = (shelter, extra = {}) =>
  service.findNearestWithSpace({
    location: shelter.location,
    district: shelter.district,
    excludeShelterId: shelter._id,
    ...extra,
  });

describe('ShelterService.findNearestWithSpace', () => {
  it('TC-34: picks the nearest shelter below 90%, with its rate, status and distance', async () => {
    const full = await make(areas.gampaha, 'Gampaha Central College', 7.0917, 79.9999, 500, 460);
    await make(areas.gampaha, 'Far Hall', 7.2228, 80.0128, 250, 75);
    const close = await make(areas.gampaha, 'Minuwangoda National School', 7.1, 80.02, 400, 304);

    const result = await near(full);

    expect(result).toEqual({
      id: close.id,
      name: 'Minuwangoda National School',
      rate: 0.76,
      status: ShelterStatus.FILLING_UP,
      distanceKm: expect.any(Number),
    });
    expect(result.distanceKm).toBeGreaterThan(1);
    expect(result.distanceKm).toBeLessThan(5);
  });

  it('never suggests the shelter itself', async () => {
    const only = await make(areas.gampaha, 'Only Hall', 7.09, 80.0, 100, 10);

    expect(await near(only)).toBeNull();
  });

  it('TC-35: skips shelters at 90% or more, even when they are the nearest', async () => {
    const full = await make(areas.gampaha, 'Full Hall', 7.09, 80.0, 100, 100);
    await make(areas.gampaha, 'Almost Hall', 7.091, 80.0, 100, 90);
    const spare = await make(areas.gampaha, 'Spare Hall', 7.3, 80.2, 100, 89);

    expect((await near(full)).id).toBe(spare.id);
  });

  it('is null when no other shelter has space (E2)', async () => {
    const full = await make(areas.gampaha, 'Full Hall', 7.09, 80.0, 100, 100);
    await make(areas.gampaha, 'Almost Hall', 7.091, 80.0, 100, 95);

    expect(await near(full)).toBeNull();
  });

  it('TC-36: only looks in the same district, however near another one is', async () => {
    const full = await make(areas.gampaha, 'Full Hall', 7.09, 80.0, 100, 100);
    await make(areas.colombo, 'Next Door Hall', 7.0901, 80.0, 100, 10);

    expect(await near(full)).toBeNull();
  });

  it('breaks a tie by name', async () => {
    const full = await make(areas.gampaha, 'Full Hall', 7.09, 80.0, 100, 100);
    await make(areas.gampaha, 'Beta Hall', 7.1, 80.0, 100, 10);
    const alpha = await make(areas.gampaha, 'Alpha Hall', 7.1, 80.0, 100, 10);

    expect((await near(full)).id).toBe(alpha.id);
  });

  it('rounds the distance to one decimal place', async () => {
    const full = await make(areas.gampaha, 'Full Hall', 7.0, 80.0, 100, 100);
    await make(areas.gampaha, 'Spare Hall', 7.0, 80.1, 100, 10);

    const { distanceKm } = await near(full);

    expect(distanceKm).toBe(11.0);
  });

  it('without an excluded shelter, every shelter is a candidate', async () => {
    const spare = await make(areas.gampaha, 'Spare Hall', 7.09, 80.0, 100, 10);

    const result = await service.findNearestWithSpace({
      location: { lat: 7.09, lng: 80.0 },
      district: areas.gampaha._id,
    });

    expect(result.id).toBe(spare.id);
  });
});

describe('ShelterService.updateOccupancy suggests the alternate (A2)', () => {
  it('TC-34: 92% flagged, with the nearest shelter below 90% as the alternate', async () => {
    const shelter = await make(areas.gampaha, 'Gampaha Central College', 7.0917, 79.9999, 500, 380);
    const spare = await make(areas.gampaha, 'Minuwangoda National School', 7.1, 80.02, 400, 304);

    const result = await service.updateOccupancy(officer, shelter.id, { occupants: 460 });

    expect(result).toMatchObject({
      flagged: true,
      status: ShelterStatus.NEAR_CAPACITY,
      alternateShelter: { id: spare.id, name: 'Minuwangoda National School', rate: 0.76 },
      dmcAlerted: false,
    });
  });

  it('is not flagged, and has no alternate, below 90%', async () => {
    const shelter = await make(areas.gampaha, 'Gampaha Central College', 7.0917, 79.9999, 500, 380);
    await make(areas.gampaha, 'Minuwangoda National School', 7.1, 80.02, 400, 304);

    const result = await service.updateOccupancy(officer, shelter.id, { occupants: 400 });

    expect(result).toMatchObject({ flagged: false, alternateShelter: null });
  });

  it('is flagged with no alternate when nothing else has space (E2 follows in DMS-148)', async () => {
    const shelter = await make(areas.gampaha, 'Gampaha Central College', 7.0917, 79.9999, 500, 380);
    await make(areas.gampaha, 'Minuwangoda National School', 7.1, 80.02, 400, 380);

    const result = await service.updateOccupancy(officer, shelter.id, { occupants: 500 });

    expect(result).toMatchObject({
      flagged: true,
      status: ShelterStatus.FULL,
      alternateShelter: null,
    });
  });
});
