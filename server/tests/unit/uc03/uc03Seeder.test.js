import { jest } from '@jest/globals';
import { OrganisationSeeder } from '../../../scripts/OrganisationSeeder.js';
import { Uc03Seeder } from '../../../scripts/Uc03Seeder.js';
import { Shelter as ShelterDomain } from '../../../src/domain/coordination/Shelter.js';
import { Role } from '../../../src/enums/Role.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { ReliefStock } from '../../../src/models/ReliefStock.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';
import { User } from '../../../src/models/User.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

let areas;
let lead;
let officer;

// What DistrictSeeder, OrganisationSeeder and PeopleSeeder leave behind, in
// the small: Gampaha, every organisation, and the two demo accounts UC03 uses.
const seedPrerequisites = async () => {
  areas = await seedAreas();
  await new OrganisationSeeder().run();
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD, email: 'rescue.lead@example.test' });
  officer = await createUser({
    role: Role.DISTRICT_OFFICER,
    email: 'district.officer@example.test',
    district: areas.gampaha,
  });
};

const ids = async (Model) => (await Model.find().sort({ _id: 1 })).map((doc) => doc.id);

beforeAll(async () => {
  await Promise.all([Shelter, RescueTeam, ReliefStock, Organisation, User].map((M) => M.init()));
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Uc03Seeder', () => {
  beforeEach(async () => {
    await seedPrerequisites();
  });

  it("DMS-140.7: seeds the hi-fi's five Gampaha shelters at 92%, 76%, 45%, 60% and 30%", async () => {
    await new Uc03Seeder().run();

    const shelters = await Shelter.find({ district: areas.gampaha._id }).sort({ name: 1 });
    const byName = Object.fromEntries(
      shelters.map((doc) => {
        const shelter = ShelterDomain.fromDocument(doc);
        return [doc.name, [Math.round(shelter.occupancyRate() * 100), shelter.status()]];
      }),
    );

    expect(byName).toEqual({
      'Attanagalla Vidyalaya': [45, ShelterStatus.AVAILABLE],
      'Divulapitiya School': [30, ShelterStatus.AVAILABLE],
      'Gampaha Central College': [92, ShelterStatus.NEAR_CAPACITY],
      'Ja-Ela Central College': [60, ShelterStatus.AVAILABLE],
      'Minuwangoda National School': [76, ShelterStatus.FILLING_UP],
    });
    expect(shelters.find((s) => s.name === 'Gampaha Central College').capacity).toBe(500);
  });

  it('DMS-140.7: seeds teams Alpha to Echo, all AVAILABLE at their base, Alpha led by the demo lead', async () => {
    await new Uc03Seeder().run();

    const teams = await RescueTeam.find().sort({ name: 1 }).populate('organisation', 'name');

    expect(
      teams.map((team) => [
        team.name,
        team.organisation.name,
        team.status,
        team.currentLocation.label,
      ]),
    ).toEqual([
      ['Team Alpha', 'SL Army', TeamStatus.AVAILABLE, 'Gampaha HQ'],
      ['Team Bravo', 'Sri Lanka Police', TeamStatus.AVAILABLE, 'Ja-Ela'],
      ['Team Charlie', 'Government/DMC', TeamStatus.AVAILABLE, 'Ragama'],
      ['Team Delta', 'SL Army', TeamStatus.AVAILABLE, 'Minuwangoda'],
      ['Team Echo', 'Fire Service', TeamStatus.AVAILABLE, 'Attanagalla'],
    ]);
    expect(String(teams[0].lead)).toBe(lead.id);
    expect(teams.slice(1).every((team) => team.lead === null)).toBe(true);
  });

  it('DMS-140.7: seeds stock per organisation, including Red Cross drinking water, 1,200 bottles', async () => {
    await new Uc03Seeder().run();

    const redCross = await Organisation.findOne({ name: 'Red Cross Sri Lanka' });
    const water = await ReliefStock.findOne({ organisation: redCross._id, supplyType: 'WATER' });

    expect(await ReliefStock.countDocuments()).toBe(5);
    expect(water).toMatchObject({ unit: 'bottles', quantityAvailable: 1200 });
  });

  it("DMS-140.7: seeds the hi-fi's five supply logs in the incident period, logged by the demo officer", async () => {
    await new Uc03Seeder().run();

    const logs = await SupplyDistribution.find().sort({ distributedAt: -1 });

    expect(logs.map((log) => [log.supplyType, log.quantity])).toEqual([
      ['WATER', 500],
      ['FOOD', 200],
      ['BLANKETS', 100],
      ['MEDICINE', 50],
      ['HYGIENE_KITS', 150],
    ]);
    expect(logs[0].distributedAt).toEqual(new Date('2026-10-03T09:00:00.000Z'));
    expect(logs.every((log) => String(log.loggedBy) === officer.id)).toBe(true);
    expect(logs.every((log) => String(log.district) === areas.gampaha.id)).toBe(true);
  });

  it('DMS-140.7: running twice keeps the same records under the same ids', async () => {
    await new Uc03Seeder().run();
    const first = await Promise.all(
      [Shelter, RescueTeam, ReliefStock, SupplyDistribution].map(ids),
    );

    await new Uc03Seeder().run();
    const second = await Promise.all(
      [Shelter, RescueTeam, ReliefStock, SupplyDistribution].map(ids),
    );

    expect(second).toEqual(first);
  });

  it('DMS-140.7: re-seeding never undoes what the demo changed (occupancy, team status, stock)', async () => {
    await new Uc03Seeder().run();
    await Shelter.updateOne({ name: 'Gampaha Central College' }, { currentOccupancy: 500 });
    await RescueTeam.updateOne({ name: 'Team Alpha' }, { status: TeamStatus.UNAVAILABLE });
    await ReliefStock.updateOne({ supplyType: 'WATER' }, { quantityAvailable: 700 });

    await new Uc03Seeder().run();

    expect((await Shelter.findOne({ name: 'Gampaha Central College' })).currentOccupancy).toBe(500);
    expect((await RescueTeam.findOne({ name: 'Team Alpha' })).status).toBe(TeamStatus.UNAVAILABLE);
    expect((await ReliefStock.findOne({ supplyType: 'WATER' })).quantityAvailable).toBe(700);
  });

  it('DMS-140.7: recreates the same ids after its collections are emptied (--reset-demo)', async () => {
    const models = [Shelter, RescueTeam, ReliefStock, SupplyDistribution];
    await new Uc03Seeder().run();
    const first = await Promise.all(models.map(ids));

    await Promise.all(models.map((Model) => Model.deleteMany({})));
    await new Uc03Seeder().run();

    expect(await Promise.all(models.map(ids))).toEqual(first);
  });

  it('DMS-140.7: lists its four collections for --reset-demo', () => {
    expect(new Uc03Seeder().demoModels).toEqual([
      Shelter,
      RescueTeam,
      ReliefStock,
      SupplyDistribution,
    ]);
  });
});

describe('Uc03Seeder prerequisites', () => {
  it('DMS-140.7: stops when Gampaha is not seeded', async () => {
    await expect(new Uc03Seeder().run()).rejects.toThrow(
      'District "Gampaha" is not seeded - run DistrictSeeder first',
    );
  });

  it('DMS-140.7: stops when an organisation is not seeded', async () => {
    await seedAreas();

    await expect(new Uc03Seeder().run()).rejects.toThrow(/Organisation ".+" is not seeded/);
  });

  it('DMS-140.7: stops when a demo account is not seeded', async () => {
    await seedAreas();
    await new OrganisationSeeder().run();

    await expect(new Uc03Seeder().run()).rejects.toThrow(
      'Demo account rescue.lead@example.test is not seeded - run PeopleSeeder first',
    );
  });
});
