import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Shelter } from '../../src/models/Shelter.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 A2 (DMS-145): an occupancy update that leaves a shelter at 90% or more
// is flagged, and the nearest shelter that still has space is suggested.
let areas;
let officer;
let main;

const make = (district, name, lat, capacity, currentOccupancy) =>
  Shelter.create({
    district: district._id,
    name,
    location: { lat, lng: 80.0 },
    capacity,
    currentOccupancy,
  });

const update = (occupants, shelter = main) =>
  request(app)
    .patch(`/api/shelters/${shelter.id}/occupancy`)
    .set('Authorization', bearerFor(officer))
    .send({ occupants });

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
  main = await make(areas.gampaha, 'Gampaha Central College', 7.09, 500, 380);
});

describe('PATCH /api/shelters/:id/occupancy: A2 flag and suggestion', () => {
  it('TC-34: an update to 92% is flagged, with the nearest shelter below 90% suggested', async () => {
    const near = await make(areas.gampaha, 'Minuwangoda National School', 7.1, 400, 304);
    await make(areas.gampaha, 'Divulapitiya School', 7.3, 250, 75);

    const res = await update(460);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      rate: 0.92,
      status: 'NEAR_CAPACITY',
      flagged: true,
      alternateShelter: { id: near.id, name: 'Minuwangoda National School', rate: 0.76 },
      dmcAlerted: false,
    });
    expect(res.body.data.alternateShelter.status).toBe('FILLING_UP');
    expect(res.body.data.alternateShelter.distanceKm).toEqual(expect.any(Number));
  });

  it('TC-34: a shelter that is FULL (over capacity) is flagged too', async () => {
    const near = await make(areas.gampaha, 'Minuwangoda National School', 7.1, 400, 100);

    const res = await update(520);

    expect(res.body.data).toMatchObject({
      status: 'FULL',
      flagged: true,
      alternateShelter: { id: near.id },
    });
  });

  it('TC-35: the nearest shelter is FULL, so the next one that is FILLING_UP is suggested', async () => {
    await make(areas.gampaha, 'Nearest But Full', 7.091, 100, 100);
    const next = await make(areas.gampaha, 'Next Filling Up', 7.2, 100, 80);
    await make(areas.gampaha, 'Further Available', 7.4, 100, 10);

    const res = await update(470);

    expect(res.body.data.alternateShelter).toMatchObject({
      id: next.id,
      name: 'Next Filling Up',
      status: 'FILLING_UP',
    });
  });

  it('TC-35: a shelter at exactly 90% does not count as having space', async () => {
    await make(areas.gampaha, 'Ninety Hall', 7.091, 100, 90);
    const below = await make(areas.gampaha, 'Eighty Nine Hall', 7.3, 100, 89);

    const res = await update(470);

    expect(res.body.data.alternateShelter.id).toBe(below.id);
  });

  it('TC-36: shelters in other districts are never suggested, however near', async () => {
    await make(areas.colombo, 'Next Door In Colombo', 7.0901, 100, 10);

    const res = await update(470);

    expect(res.body.data).toMatchObject({ flagged: true, alternateShelter: null });
  });

  it('is not flagged below 90%, and suggests nothing', async () => {
    await make(areas.gampaha, 'Minuwangoda National School', 7.1, 400, 304);

    const res = await update(449);

    expect(res.body.data).toMatchObject({
      rate: 0.898,
      status: 'FILLING_UP',
      flagged: false,
      alternateShelter: null,
    });
  });

  it('is flagged at exactly 90%', async () => {
    await make(areas.gampaha, 'Minuwangoda National School', 7.1, 400, 304);

    const res = await update(450);

    expect(res.body.data).toMatchObject({ status: 'NEAR_CAPACITY', flagged: true });
  });

  it('suggests nothing when no other shelter has space (E2 is DMS-148)', async () => {
    await make(areas.gampaha, 'Also Full', 7.1, 100, 95);

    const res = await update(480);

    expect(res.body.data).toMatchObject({ flagged: true, alternateShelter: null });
  });

  it('never suggests the shelter being updated, and the update is still saved', async () => {
    const res = await update(480);

    expect(res.body.data.alternateShelter).toBeNull();
    expect((await Shelter.findById(main._id)).currentOccupancy).toBe(480);
  });

  it('the suggestion is not stored: nothing is redirected until the officer does it', async () => {
    await make(areas.gampaha, 'Minuwangoda National School', 7.1, 400, 304);

    const res = await update(470);

    expect(res.body.data.shelter.redirectingTo).toBeNull();
  });
});
