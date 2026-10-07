import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { OccupancyRecord } from '../../src/models/OccupancyRecord.js';
import { Shelter } from '../../src/models/Shelter.js';
import { ShelterRedirect } from '../../src/models/ShelterRedirect.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 A2.3 (DMS-145): the officer redirects new arrivals from a nearly full
// shelter to one with space.
let areas;
let officer;
let full;
let spare;

const as = (user) => ({
  get: (path) => request(app).get(path).set('Authorization', bearerFor(user)),
  post: (path, body) => request(app).post(path).set('Authorization', bearerFor(user)).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', bearerFor(user)).send(body),
});

const make = (district, name, lat, capacity, currentOccupancy) =>
  Shelter.create({
    district: district._id,
    name,
    location: { lat, lng: 80.0 },
    capacity,
    currentOccupancy,
  });

const redirect = (from, to, user = officer) =>
  as(user).post(`/api/shelters/${from.id}/redirects`, { toShelterId: to.id });

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
  full = await make(areas.gampaha, 'Gampaha Central College', 7.09, 500, 460);
  spare = await make(areas.gampaha, 'Minuwangoda National School', 7.1, 400, 304);
});

describe('POST /api/shelters/:id/redirects', () => {
  it('TC-37: A2.3 stores the redirect and answers 201 with both shelters, the district and the officer', async () => {
    const res = await redirect(full, spare);

    expect(res.status).toBe(201);
    expect(res.body.data.redirect).toMatchObject({
      from: { id: full.id, name: 'Gampaha Central College' },
      to: { id: spare.id, name: 'Minuwangoda National School' },
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      by: { id: officer.id },
    });
    const stored = await ShelterRedirect.find();
    expect(stored).toHaveLength(1);
    expect(String(stored[0].from)).toBe(full.id);
    expect(String(stored[0].to)).toBe(spare.id);
    expect(stored[0].at).toBeInstanceOf(Date);
  });

  it('changes neither shelter, and writes no occupancy record', async () => {
    await redirect(full, spare);

    expect((await Shelter.findById(full._id)).currentOccupancy).toBe(460);
    expect((await Shelter.findById(spare._id)).currentOccupancy).toBe(304);
    expect(await OccupancyRecord.countDocuments()).toBe(0);
  });

  it('TC-38: a target that filled up meanwhile is 409 SHELTER_NO_SPACE, naming how full, and stores nothing', async () => {
    await Shelter.updateOne({ _id: spare._id }, { currentOccupancy: 364 });

    const res = await redirect(full, spare);

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'SHELTER_NO_SPACE',
      message: 'Minuwangoda National School has no spare capacity (91%).',
    });
    expect(await ShelterRedirect.countDocuments()).toBe(0);
  });

  it.each([
    [359, 201],
    [360, 409],
    [400, 409],
    [420, 409],
  ])('the target at %i of 400 (the 90 percent line is 360) is %i', async (occupants, expected) => {
    await Shelter.updateOne({ _id: spare._id }, { currentOccupancy: occupants });

    expect((await redirect(full, spare)).status).toBe(expected);
  });

  it('shows on the source shelter as redirectingTo while it is flagged, in the list', async () => {
    await redirect(full, spare);

    const res = await as(officer).get('/api/shelters');

    const shown = res.body.data.shelters.find((s) => s.id === full.id);
    expect(shown.redirectingTo).toEqual({ id: spare.id, name: 'Minuwangoda National School' });
    expect(res.body.data.shelters.find((s) => s.id === spare.id).redirectingTo).toBeNull();
  });

  it('shows on the dashboard too ("Redirecting to Minuwangoda National School")', async () => {
    await redirect(full, spare);

    const res = await as(officer).get('/api/operational-picture');

    expect(res.body.data.shelters.find((s) => s.id === full.id).redirectingTo).toEqual({
      id: spare.id,
      name: 'Minuwangoda National School',
    });
  });

  it('ends by itself when an update brings the shelter below 90%', async () => {
    await redirect(full, spare);

    const update = await as(officer).patch(`/api/shelters/${full.id}/occupancy`, {
      occupants: 400,
    });
    const list = await as(officer).get('/api/shelters');

    expect(update.body.data.shelter.redirectingTo).toBeNull();
    expect(list.body.data.shelters.find((s) => s.id === full.id).redirectingTo).toBeNull();
  });

  it('returns when the shelter is flagged again, since the redirect record is still the latest', async () => {
    await redirect(full, spare);
    await as(officer).patch(`/api/shelters/${full.id}/occupancy`, { occupants: 400 });

    const update = await as(officer).patch(`/api/shelters/${full.id}/occupancy`, {
      occupants: 480,
    });

    expect(update.body.data.shelter.redirectingTo).toMatchObject({ id: spare.id });
  });

  it('a later redirect replaces the earlier one as the current, and the first stays as history', async () => {
    const other = await make(areas.gampaha, 'Ja-Ela Central College', 7.12, 350, 210);
    await redirect(full, spare);
    await redirect(full, other);

    const list = await as(officer).get('/api/shelters');

    expect(list.body.data.shelters.find((s) => s.id === full.id).redirectingTo.id).toBe(other.id);
    expect(await ShelterRedirect.countDocuments()).toBe(2);
  });

  it('is stored from a shelter that is not flagged yet, but not shown until it is', async () => {
    const other = await make(areas.gampaha, 'Ja-Ela Central College', 7.12, 350, 210);

    const res = await redirect(spare, other);
    const list = await as(officer).get('/api/shelters');

    expect(res.status).toBe(201);
    expect(list.body.data.shelters.find((s) => s.id === spare.id).redirectingTo).toBeNull();
  });

  it('a flagged shelter cannot be the target, since it has no spare capacity', async () => {
    const res = await redirect(spare, full);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SHELTER_NO_SPACE');
  });

  it('the occupancy update that flags a shelter shows its existing redirect', async () => {
    await redirect(full, spare);
    await as(officer).patch(`/api/shelters/${full.id}/occupancy`, { occupants: 100 });

    const res = await as(officer).patch(`/api/shelters/${full.id}/occupancy`, {
      occupants: 470,
    });

    expect(res.body.data.flagged).toBe(true);
    expect(res.body.data.shelter.redirectingTo).toMatchObject({
      name: 'Minuwangoda National School',
    });
  });

  it('400 on toShelterId for the same shelter', async () => {
    const res = await redirect(full, full);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'toShelterId', message: 'must be another shelter' },
    ]);
  });

  it('400 on toShelterId for a shelter in another district', async () => {
    const elsewhere = await make(areas.colombo, 'Colombo Hall', 6.9, 100, 10);

    const res = await redirect(full, elsewhere);

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual([
      { field: 'toShelterId', message: 'must be a shelter in the same district' },
    ]);
    expect(await ShelterRedirect.countDocuments()).toBe(0);
  });

  it.each([[{}], [{ toShelterId: 'not-an-id' }], [{ toShelterId: 42 }]])(
    '400 on toShelterId when it is missing or malformed (%p)',
    async (body) => {
      const res = await as(officer).post(`/api/shelters/${full.id}/redirects`, body);

      expect(res.status).toBe(400);
      expect(res.body.error.errors.map((e) => e.field)).toEqual(['toShelterId']);
    },
  );

  it('404 for a source or target no shelter has', async () => {
    const missing = '66fb0a1b2c3d4e5f6a7b8caa';

    const noTarget = await as(officer).post(`/api/shelters/${full.id}/redirects`, {
      toShelterId: missing,
    });
    const noSource = await as(officer).post(`/api/shelters/${missing}/redirects`, {
      toShelterId: spare.id,
    });

    expect(noTarget.status).toBe(404);
    expect(noSource.status).toBe(404);
  });

  it('403 for a shelter in another district', async () => {
    const elsewhere = await make(areas.colombo, 'Colombo Hall', 6.9, 100, 100);

    const res = await redirect(elsewhere, spare);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 for a DMC officer, who only reads', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    expect((await redirect(full, spare, dmc)).status).toBe(403);
  });

  it('409 NO_ACTIVE_INCIDENT when the district has none, and nothing is stored', async () => {
    await HazardEvent.deleteMany({});

    const res = await redirect(full, spare);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_ACTIVE_INCIDENT');
    expect(await ShelterRedirect.countDocuments()).toBe(0);
  });

  it('401 without a token', async () => {
    const res = await request(app)
      .post(`/api/shelters/${full.id}/redirects`)
      .send({ toShelterId: spare.id });

    expect(res.status).toBe(401);
  });
});
