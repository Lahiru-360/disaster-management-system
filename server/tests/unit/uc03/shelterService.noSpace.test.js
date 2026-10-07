import { jest } from '@jest/globals';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { NotificationType } from '../../../src/enums/NotificationType.js';
import { Role } from '../../../src/enums/Role.js';
import { DistrictCapacityAlert } from '../../../src/models/DistrictCapacityAlert.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { UserNotification } from '../../../src/models/UserNotification.js';
import { ShelterService } from '../../../src/services/ShelterService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { FakeClock } from '../../helpers/FakeClock.js';
import { createUser } from '../../helpers/userFactory.js';

// UC03 E2 (DMS-148): no shelter in the district has space, so every DMC
// officer is told - at most once an hour for the district while it lasts.
const START = '2026-10-03T09:00:00.000Z';

let areas;
let officer;
let dmc;
let duty;
let clock;
let service;
let alpha;
let beta;

const make = (name, lat, capacity, currentOccupancy, district = areas.gampaha) =>
  Shelter.create({
    district: district._id,
    name,
    location: { lat, lng: 80.0 },
    capacity,
    currentOccupancy,
  });

const update = (shelter, occupants) => service.updateOccupancy(officer, shelter.id, { occupants });

const alertsTo = (user) =>
  UserNotification.find({ user: user._id, type: NotificationType.SHELTER_CAPACITY });

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
  duty = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: areas.colombo });
  clock = new FakeClock(START);
  service = new ShelterService({ clock });
  // Beta is already at 95%; Alpha is the one the officer updates.
  alpha = await make('Gampaha Central College', 7.09, 100, 80);
  beta = await make('Minuwangoda National School', 7.1, 100, 95);
});

describe('E2: every shelter in the district is near capacity or full', () => {
  it('TC-47: alternateShelter is null, dmcAlerted is true, and every DMC officer is notified', async () => {
    const result = await update(alpha, 92);

    expect(result).toMatchObject({ flagged: true, alternateShelter: null, dmcAlerted: true });
    for (const recipient of [dmc, duty]) {
      const [item] = await alertsTo(recipient);
      expect(item).toMatchObject({
        title: 'No shelter with space in Gampaha',
        body: 'All shelters in Gampaha are near capacity or full (Gampaha Central College 92%)',
      });
    }
  });

  it('TC-47: nobody else is notified: not the district officer, not a citizen', async () => {
    const citizen = await createUser({ role: Role.CITIZEN });

    await update(alpha, 92);

    expect(await alertsTo(officer)).toHaveLength(0);
    expect(await alertsTo(citizen)).toHaveLength(0);
  });

  it('TC-47: a FULL shelter, over capacity, alerts too and names its rate', async () => {
    await update(alpha, 105);

    const [item] = await alertsTo(dmc);
    expect(item.body).toBe(
      'All shelters in Gampaha are near capacity or full (Gampaha Central College 105%)',
    );
  });

  it('TC-48: the condition lasting within the hour sends no second alert, yet dmcAlerted stays true', async () => {
    await update(alpha, 92);
    clock.advance(10 * FakeClock.MINUTE);

    const second = await update(alpha, 94);

    expect(second).toMatchObject({ flagged: true, alternateShelter: null, dmcAlerted: true });
    expect(await alertsTo(dmc)).toHaveLength(1);
  });

  it('TC-48: another shelter filling up within the hour does not alert again either', async () => {
    await update(alpha, 92);
    clock.advance(5 * FakeClock.MINUTE);

    const result = await update(beta, 99);

    expect(result.dmcAlerted).toBe(true);
    expect(await alertsTo(dmc)).toHaveLength(1);
  });

  it('TC-48: one second short of the hour is still the same alert; at the hour a new one goes', async () => {
    await update(alpha, 92);

    clock.advance(FakeClock.HOUR - 1000);
    await update(alpha, 93);
    expect(await alertsTo(dmc)).toHaveLength(1);

    clock.advance(1000);
    await update(alpha, 94);
    expect(await alertsTo(dmc)).toHaveLength(2);
  });

  it('TC-49: space appeared in between, then everything is full again: the alert goes again, within the hour', async () => {
    await update(alpha, 92);
    clock.advance(10 * FakeClock.MINUTE);
    const space = await update(alpha, 50);
    expect(space).toMatchObject({ flagged: false, dmcAlerted: false });
    clock.advance(10 * FakeClock.MINUTE);

    const again = await update(alpha, 96);

    expect(again.dmcAlerted).toBe(true);
    expect(await alertsTo(dmc)).toHaveLength(2);
  });

  it('TC-49: another shelter dropping below 90% is also space, so the next full-up alerts again', async () => {
    await update(alpha, 92);
    await update(beta, 60);
    await update(beta, 95);

    expect(await alertsTo(dmc)).toHaveLength(2);
  });

  it('TC-49: registering a new shelter is space too', async () => {
    await update(alpha, 92);
    await service.create(officer, {
      name: 'Ja-Ela Hall',
      location: { lat: 7.12, lng: 80.0 },
      capacity: 100,
    });
    await Shelter.deleteOne({ name: 'Ja-Ela Hall' });

    await update(alpha, 93);

    expect(await alertsTo(dmc)).toHaveLength(2);
  });

  it('is not alerted while another shelter has space: it is suggested instead', async () => {
    const spare = await make('Divulapitiya School', 7.3, 100, 40);

    const result = await update(alpha, 92);

    expect(result).toMatchObject({ flagged: true, alternateShelter: { id: spare.id } });
    expect(result.dmcAlerted).toBe(false);
    expect(await alertsTo(dmc)).toHaveLength(0);
  });

  it('is not alerted when the update leaves the shelter below 90%', async () => {
    const calm = await update(alpha, 50);

    expect(calm).toMatchObject({ flagged: false, dmcAlerted: false });
    expect(await alertsTo(dmc)).toHaveLength(0);
  });

  it('only counts shelters of the same district: a roomy shelter elsewhere does not stop the alert', async () => {
    await make('Colombo Hall', 6.9, 100, 10, areas.colombo);

    const result = await update(alpha, 92);

    expect(result.dmcAlerted).toBe(true);
  });

  it('keeps each district to its own hour', async () => {
    await HazardEvent.create({
      name: 'Flood – Colombo District',
      hazardType: 'FLOOD',
      status: EventStatus.ACTIVE,
      startDate: new Date('2026-09-25T00:00:00.000Z'),
      districts: [areas.colombo._id],
    });
    const colomboOfficer = await createUser({
      role: Role.DISTRICT_OFFICER,
      district: areas.colombo,
    });
    const colomboHall = await make('Colombo Hall', 6.9, 100, 80, areas.colombo);

    await update(alpha, 92);
    await service.updateOccupancy(colomboOfficer, colomboHall.id, { occupants: 95 });

    const [first, second] = (await alertsTo(dmc)).sort((a, b) => a.body.localeCompare(b.body));
    expect(first.body).toContain('Colombo');
    expect(second.body).toContain('Gampaha');
  });

  it('two updates at once send one alert', async () => {
    await Promise.all([update(alpha, 92), update(beta, 97)]);

    expect(await alertsTo(dmc)).toHaveLength(1);
  });

  it('a failed notification never fails the update', async () => {
    const failing = new ShelterService({
      clock,
      notifications: {
        notifyRole: async () => {
          throw new Error('inbox down');
        },
      },
    });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await failing.updateOccupancy(officer, alpha.id, { occupants: 92 });

    expect(result).toMatchObject({ flagged: true, dmcAlerted: true });
    expect((await Shelter.findById(alpha._id)).currentOccupancy).toBe(92);
    log.mockRestore();
  });

  it('records when the DMC was last alerted for the district', async () => {
    await update(alpha, 92);

    const record = await DistrictCapacityAlert.findOne({ district: areas.gampaha._id });

    expect(record.lastCapacityAlertAt).toEqual(new Date(START));
  });
});
