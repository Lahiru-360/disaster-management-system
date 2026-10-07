import { EventStatus } from '../../../src/enums/EventStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { ShelterRedirect } from '../../../src/models/ShelterRedirect.js';
import { ShelterService } from '../../../src/services/ShelterService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

const NOW = '2026-10-03T09:30:00.000Z';

let areas;
let officer;
let colomboOfficer;
let dmc;
let clock;
let service;
let incident;

const make = (name, capacity, currentOccupancy, district = areas.gampaha) =>
  Shelter.create({
    district: district._id,
    name,
    location: { lat: 7.09, lng: 80.0 },
    capacity,
    currentOccupancy,
  });

beforeEach(async () => {
  areas = await seedAreas();
  incident = await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: new Date('2026-09-25T00:00:00.000Z'),
    districts: [areas.gampaha._id],
  });
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });
  colomboOfficer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.colombo });
  dmc = await createUser({ role: Role.DMC_OFFICER });
  clock = new FakeClock(NOW);
  service = new ShelterService({ clock });
});

describe('ShelterService.redirect', () => {
  it('TC-37: A2.3 stores the redirect with who made it and when, as the contract’s record', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const to = await make('Minuwangoda National School', 400, 304);

    const redirect = await service.redirect(officer, from.id, { toShelterId: to.id });

    expect(redirect).toEqual({
      id: expect.any(String),
      from: { id: from.id, name: 'Gampaha Central College' },
      to: { id: to.id, name: 'Minuwangoda National School' },
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      by: { id: officer.id, name: officer.name },
      at: new Date(NOW),
    });
    expect(await ShelterRedirect.countDocuments()).toBe(1);
  });

  it('TC-38: A2.3 a target that filled up meanwhile is 409 SHELTER_NO_SPACE, naming how full, and nothing is stored', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const to = await make('Minuwangoda National School', 400, 360);

    await expect(service.redirect(officer, from.id, { toShelterId: to.id })).rejects.toMatchObject({
      status: 409,
      code: 'SHELTER_NO_SPACE',
      message: 'Minuwangoda National School has no spare capacity (90%).',
    });
    expect(await ShelterRedirect.countDocuments()).toBe(0);
  });

  it('TC-38: A2.3 a target just below 90% is still accepted', async () => {
    const from = await make('Full Hall', 100, 100);
    const to = await make('Nearly Hall', 100, 89);

    await expect(service.redirect(officer, from.id, { toShelterId: to.id })).resolves.toBeDefined();
  });

  it('A2.3: a shelter cannot be redirected to itself, or to a shelter of another district (400 on toShelterId)', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const elsewhere = await make('Colombo Hall', 400, 10, areas.colombo);

    await expect(
      service.redirect(officer, from.id, { toShelterId: from.id }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'toShelterId', message: 'must be another shelter' }],
    });
    await expect(
      service.redirect(officer, from.id, { toShelterId: elsewhere.id }),
    ).rejects.toMatchObject({
      status: 400,
      errors: [{ field: 'toShelterId', message: 'must be a shelter in the same district' }],
    });
    expect(await ShelterRedirect.countDocuments()).toBe(0);
  });

  it('TC-29: A2.3 an officer of another district is 403', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const to = await make('Minuwangoda National School', 400, 100);

    await expect(
      service.redirect(colomboOfficer, from.id, { toShelterId: to.id }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('A2.3: a DMC officer only reads, so cannot redirect (403)', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const to = await make('Minuwangoda National School', 400, 100);

    await expect(service.redirect(dmc, from.id, { toShelterId: to.id })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('A2.3: 409 NO_ACTIVE_INCIDENT once the incident has ended', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const to = await make('Minuwangoda National School', 400, 100);
    await HazardEvent.updateOne({ _id: incident._id }, { status: EventStatus.CLOSED });

    await expect(service.redirect(officer, from.id, { toShelterId: to.id })).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_INCIDENT',
    });
  });

  it('A2.3: an unknown or malformed shelter id is 404', async () => {
    const to = await make('Minuwangoda National School', 400, 100);

    await expect(
      service.redirect(officer, '66fb0c1b2c3d4e5f6a7b8e99', { toShelterId: to.id }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.redirect(officer, 'not-an-id', { toShelterId: to.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('ShelterService.redirectsFor and list', () => {
  it('A2: a flagged shelter shows the target of its latest redirect, not an earlier one', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const first = await make('Minuwangoda National School', 400, 100);
    const second = await make('Ja-Ela Hall', 300, 50);
    await service.redirect(officer, from.id, { toShelterId: first.id });
    clock.advance(FakeClock.MINUTE);
    await service.redirect(officer, from.id, { toShelterId: second.id });

    const listed = await service.list(officer);

    expect(listed.find((s) => s.id === from.id).redirectingTo).toEqual({
      id: second.id,
      name: 'Ja-Ela Hall',
    });
  });

  it('A2: the redirect ends by itself once the shelter drops below 90%', async () => {
    const from = await make('Gampaha Central College', 500, 460);
    const to = await make('Minuwangoda National School', 400, 100);
    await service.redirect(officer, from.id, { toShelterId: to.id });
    await Shelter.updateOne({ _id: from._id }, { currentOccupancy: 300 });

    expect((await service.list(officer)).find((s) => s.id === from.id).redirectingTo).toBeNull();
  });

  it('Main 2: lists the district’s shelters sorted by name, and none of another district', async () => {
    await make('Zeta Hall', 100, 10);
    await make('Alpha Hall', 100, 10);
    await make('Colombo Hall', 100, 10, areas.colombo);

    const listed = await service.list(officer);

    expect(listed.map((s) => s.name)).toEqual(['Alpha Hall', 'Zeta Hall']);
  });

  it('Main 2: no shelter is flagged, so no redirect lookup is needed', async () => {
    await make('Alpha Hall', 100, 10);

    expect(await service.redirectsFor(await Shelter.find())).toEqual(new Map());
  });

  it('TC-02: a DMC officer must name the district, and an officer cannot read another', async () => {
    await expect(service.list(dmc)).rejects.toMatchObject({ status: 400 });
    await expect(service.list(dmc, { districtId: areas.gampaha.id })).resolves.toEqual([]);
    await expect(service.list(officer, { districtId: areas.colombo.id })).rejects.toMatchObject({
      status: 403,
    });
  });
});
