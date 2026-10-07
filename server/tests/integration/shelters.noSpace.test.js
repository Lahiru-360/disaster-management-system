import request from 'supertest';
import { app } from '../../src/core/App.js';
import { EventStatus } from '../../src/enums/EventStatus.js';
import { Role } from '../../src/enums/Role.js';
import { DistrictCapacityAlert } from '../../src/models/DistrictCapacityAlert.js';
import { HazardEvent } from '../../src/models/HazardEvent.js';
import { Shelter } from '../../src/models/Shelter.js';
import { UserNotification } from '../../src/models/UserNotification.js';
import { seedAreas } from '../helpers/areaFixtures.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// UC03 E2 (DMS-148): the occupancy endpoint tells the officer there is no
// shelter with space, and the DMC officers' inbox shows the alert.
let areas;
let officer;
let dmc;
let alpha;

const make = (name, lat, capacity, currentOccupancy) =>
  Shelter.create({
    district: areas.gampaha._id,
    name,
    location: { lat, lng: 80.0 },
    capacity,
    currentOccupancy,
  });

const update = (shelter, occupants) =>
  request(app)
    .patch(`/api/shelters/${shelter.id}/occupancy`)
    .set('Authorization', bearerFor(officer))
    .send({ occupants });

// The once-an-hour window leans on the alert record's unique district index to
// refuse a second record; the test database must have built it before the
// first update, or a second alert can slip through.
beforeAll(async () => {
  await DistrictCapacityAlert.init();
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
  dmc = await createUser({ role: Role.DMC_OFFICER });
  alpha = await make('Gampaha Central College', 7.09, 500, 380);
  await make('Minuwangoda National School', 7.1, 400, 380);
});

describe('PATCH /api/shelters/:id/occupancy when no shelter has space (E2)', () => {
  it('TC-47: the response has no alternate and dmcAlerted true, and the DMC officer sees the alert in their inbox', async () => {
    const res = await update(alpha, 460);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      flagged: true,
      alternateShelter: null,
      dmcAlerted: true,
    });

    const inbox = await request(app)
      .get('/api/notifications/me')
      .set('Authorization', bearerFor(dmc));
    expect(inbox.body.data.notifications[0]).toMatchObject({
      type: 'SHELTER_CAPACITY',
      body: 'All shelters in Gampaha are near capacity or full (Gampaha Central College 92%)',
    });
  });

  it('TC-48: a second update straight after sends no second alert but still says dmcAlerted', async () => {
    await update(alpha, 460);

    const res = await update(alpha, 470);

    expect(res.body.data.dmcAlerted).toBe(true);
    expect(await UserNotification.countDocuments({ user: dmc._id, type: 'SHELTER_CAPACITY' })).toBe(
      1,
    );
  });

  it('TC-49: after space appeared, filling up again alerts again', async () => {
    await update(alpha, 460);
    await update(alpha, 100);

    const res = await update(alpha, 480);

    expect(res.body.data.dmcAlerted).toBe(true);
    expect(await UserNotification.countDocuments({ user: dmc._id, type: 'SHELTER_CAPACITY' })).toBe(
      2,
    );
  });

  it('an update that is not flagged says dmcAlerted false', async () => {
    const res = await update(alpha, 100);

    expect(res.body.data).toMatchObject({ flagged: false, dmcAlerted: false });
  });

  it('the update is saved whether or not an alert goes out', async () => {
    await update(alpha, 460);

    expect((await Shelter.findById(alpha._id)).currentOccupancy).toBe(460);
  });
});
