import { EventStatus } from '../../../src/enums/EventStatus.js';
import { Role } from '../../../src/enums/Role.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { ShelterService } from '../../../src/services/ShelterService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

let areas;
let officer;

const input = {
  name: 'Ja-Ela Central College',
  location: { lat: 7.0744, lng: 79.8919, label: 'Ja-Ela' },
  capacity: 300,
};

beforeAll(async () => {
  await Shelter.init();
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
});

describe('ShelterService.create', () => {
  it('TC-30: A1.2 creates the shelter empty in the officer’s district, as the contract’s shelter object', async () => {
    const { shelter } = await new ShelterService().create(officer, input);

    expect(shelter).toMatchObject({
      name: 'Ja-Ela Central College',
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      capacity: 300,
      currentOccupancy: 0,
      rate: 0,
      status: 'AVAILABLE',
    });
    expect(await Shelter.countDocuments({ district: areas.gampaha._id })).toBe(1);
  });

  it('TC-32: names the district in SHELTER_NAME_TAKEN', async () => {
    const service = new ShelterService();
    await service.create(officer, input);

    await expect(
      service.create(officer, { ...input, name: 'ja-ela central college' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'SHELTER_NAME_TAKEN',
      message: 'A shelter named "ja-ela central college" already exists in Gampaha.',
    });
  });

  it('says "this district" if the district can no longer be found', async () => {
    const service = new ShelterService({
      districtModel: { findById: () => ({ select: async () => null }) },
    });
    await service.create(officer, input);

    await expect(service.create(officer, input)).rejects.toMatchObject({
      message: 'A shelter named "Ja-Ela Central College" already exists in this district.',
    });
  });

  it('lets any other failure of the save through unchanged', async () => {
    const failure = new Error('connection lost');
    const service = new ShelterService({
      shelterModel: {
        create: async () => {
          throw failure;
        },
      },
    });

    await expect(service.create(officer, input)).rejects.toBe(failure);
  });

  it('refuses before saving when the district has no active incident', async () => {
    await HazardEvent.deleteMany({});

    await expect(new ShelterService().create(officer, input)).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_INCIDENT',
    });
    expect(await Shelter.countDocuments()).toBe(0);
  });
});

describe('Shelter name index', () => {
  it('TC-32: is unique per district ignoring case, and the same name elsewhere is fine', async () => {
    const base = { location: { lat: 7, lng: 80 }, capacity: 100 };
    await Shelter.create({ ...base, district: areas.gampaha._id, name: 'Hall' });

    await expect(
      Shelter.create({ ...base, district: areas.gampaha._id, name: 'HALL' }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      Shelter.create({ ...base, district: areas.colombo._id, name: 'Hall' }),
    ).resolves.toBeDefined();
  });
});
