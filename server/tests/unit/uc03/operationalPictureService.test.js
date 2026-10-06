import mongoose from 'mongoose';
import { EventStatus } from '../../../src/enums/EventStatus.js';
import { OrgType } from '../../../src/enums/OrgType.js';
import { Role } from '../../../src/enums/Role.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';
import { HazardEvent } from '../../../src/models/HazardEvent.js';
import { Organisation } from '../../../src/models/Organisation.js';
import { ReliefStock } from '../../../src/models/ReliefStock.js';
import { RescueTeam } from '../../../src/models/RescueTeam.js';
import { Shelter } from '../../../src/models/Shelter.js';
import { SupplyDistribution } from '../../../src/models/SupplyDistribution.js';
import { OperationalPictureService } from '../../../src/services/OperationalPictureService.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const service = new OperationalPictureService();
const camp = { lat: 7.0873, lng: 80.0144, label: 'Gampaha Army Camp' };
const INCIDENT_START = new Date('2026-09-25T00:00:00.000Z');

let areas;
let orgs;
let officer;
let lead;
let shelters;
let stock;

const shelter = (district, name, capacity, currentOccupancy) =>
  Shelter.create({
    district,
    name,
    location: { lat: 7.09, lng: 79.99 },
    capacity,
    currentOccupancy,
  });

const team = (district, name, organisation, fields = {}) =>
  RescueTeam.create({
    name,
    organisation,
    district,
    memberCount: 6,
    baseLocation: camp,
    currentLocation: camp,
    ...fields,
  });

const distribute = (stockRow, toShelter, quantity, distributedAt) =>
  SupplyDistribution.create({
    shelter: toShelter._id,
    stock: stockRow._id,
    organisation: stockRow.organisation,
    supplyType: stockRow.supplyType,
    district: stockRow.district,
    quantity,
    distributedAt: new Date(distributedAt),
    loggedBy: officer._id,
  });

beforeEach(async () => {
  areas = await seedAreas();
  const { gampaha, colombo } = areas;

  orgs = {
    army: await Organisation.create({ name: 'SL Army', type: OrgType.ARMED_FORCES }),
    redCross: await Organisation.create({ name: 'Red Cross Sri Lanka', type: OrgType.NGO }),
    fire: await Organisation.create({ name: 'Fire Service', type: OrgType.GOVERNMENT }),
    unicef: await Organisation.create({ name: 'UNICEF Sri Lanka', type: OrgType.DONOR }),
  };
  officer = await createUser({ role: Role.DISTRICT_OFFICER, district: gampaha, name: 'Dilani W' });
  lead = await createUser({ role: Role.RESCUE_TEAM_LEAD, name: 'Suresh Bandara' });

  await HazardEvent.create({
    name: 'Flood – Gampaha District',
    hazardType: 'FLOOD',
    status: EventStatus.ACTIVE,
    startDate: INCIDENT_START,
    districts: [gampaha._id],
  });

  shelters = {
    central: await shelter(gampaha._id, 'Gampaha Central College', 500, 460),
    minuwangoda: await shelter(gampaha._id, 'Minuwangoda National School', 500, 380),
    attanagalla: await shelter(gampaha._id, 'Attanagalla Vidyalaya', 200, 0),
    colombo: await shelter(colombo._id, 'Colombo Hall', 100, 100),
  };

  await team(gampaha._id, 'Team Alpha', orgs.army._id, { lead: lead._id });
  await team(gampaha._id, 'Team Echo', orgs.fire._id, { status: TeamStatus.DISPATCHED });
  await team(colombo._id, 'Team Bravo', orgs.army._id);

  const row = (organisation, district, supplyType, unit, quantityAvailable) =>
    ReliefStock.create({ organisation, district, supplyType, unit, quantityAvailable });
  stock = {
    water: await row(orgs.redCross._id, gampaha._id, SupplyType.WATER, 'bottles', 1200),
    food: await row(orgs.redCross._id, gampaha._id, SupplyType.FOOD, 'packs', 300),
    medicine: await row(orgs.army._id, gampaha._id, SupplyType.MEDICINE, 'boxes', 50),
    colomboWater: await row(orgs.redCross._id, colombo._id, SupplyType.WATER, 'bottles', 999),
  };

  await distribute(stock.water, shelters.central, 500, '2026-10-01T10:00:00.000Z');
  await distribute(stock.water, shelters.minuwangoda, 100, '2026-09-20T10:00:00.000Z');
  await distribute(stock.medicine, shelters.central, 10, '2026-10-02T09:00:00.000Z');
  await distribute(stock.colomboWater, shelters.colombo, 77, '2026-10-01T08:00:00.000Z');
});

describe('OperationalPictureService.getCombinedPicture', () => {
  it("TC-01: Main 1-2 shows only the district's shelters, teams and supply logs", async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });

    expect(picture.district).toEqual({ id: areas.gampaha.id, name: 'Gampaha' });
    expect(picture.shelters.map((s) => s.name)).toEqual([
      'Attanagalla Vidyalaya',
      'Gampaha Central College',
      'Minuwangoda National School',
    ]);
    expect(picture.teams.map((t) => t.name)).toEqual(['Team Alpha', 'Team Echo']);
    expect(picture.recentDistributions.map((d) => d.quantity)).toEqual([10, 500, 100]);
  });

  it('Main 2: shelters carry their occupancy rate and status', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });
    const central = picture.shelters.find((s) => s.name === 'Gampaha Central College');

    expect(central).toMatchObject({
      id: shelters.central.id,
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      capacity: 500,
      currentOccupancy: 460,
      rate: 0.92,
      status: ShelterStatus.NEAR_CAPACITY,
      redirectingTo: null,
      location: { lat: 7.09, lng: 79.99, label: null },
    });
  });

  it('Main 2: teams carry their owning organisation, lead and status', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });
    const [alpha, echo] = picture.teams;

    expect(alpha).toMatchObject({
      name: 'Team Alpha',
      organisation: { id: orgs.army.id, name: 'SL Army', type: OrgType.ARMED_FORCES },
      lead: { id: lead.id, name: 'Suresh Bandara' },
      status: TeamStatus.AVAILABLE,
      currentTask: null,
      baseLocation: camp,
    });
    expect(echo.lead).toBeNull();
  });

  it('Main 2: supply logs carry the shelter, owner organisation, unit and who logged them', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });

    expect(picture.recentDistributions[1]).toEqual({
      id: expect.any(String),
      shelter: { id: shelters.central.id, name: 'Gampaha Central College' },
      stockId: stock.water.id,
      organisation: { id: orgs.redCross.id, name: 'Red Cross Sri Lanka', type: OrgType.NGO },
      district: { id: areas.gampaha.id, name: 'Gampaha' },
      supplyType: SupplyType.WATER,
      unit: 'bottles',
      quantity: 500,
      distributedAt: new Date('2026-10-01T10:00:00.000Z'),
      loggedBy: { id: officer.id, name: 'Dilani W' },
    });
  });

  it('Main 1: names the district’s ACTIVE incident', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });

    expect(picture.incident).toMatchObject({
      name: 'Flood – Gampaha District',
      hazardType: 'FLOOD',
      startDate: INCIDENT_START,
    });
    expect(picture.organisation).toBeNull();
  });

  it('Main 2: summarises shelters, teams, supplies since the incident began, and people sheltered', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });

    expect(picture.summary).toEqual({
      shelters: 3,
      sheltersNearCapacity: 1,
      teams: 2,
      teamsAvailable: 1,
      suppliesDistributed: 510,
      affectedPeople: 840,
    });
  });

  it('TC-05: Main 14 totals every organisation with a team, stock or distribution in the district', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });

    expect(picture.totalsByOrganisation).toEqual([
      {
        organisation: { id: orgs.fire.id, name: 'Fire Service', type: OrgType.GOVERNMENT },
        teams: 1,
        stockItems: 0,
        distributed: 0,
      },
      {
        organisation: { id: orgs.redCross.id, name: 'Red Cross Sri Lanka', type: OrgType.NGO },
        teams: 0,
        stockItems: 1500,
        distributed: 500,
      },
      {
        organisation: { id: orgs.army.id, name: 'SL Army', type: OrgType.ARMED_FORCES },
        teams: 1,
        stockItems: 50,
        distributed: 10,
      },
    ]);
  });

  it('TC-06: Main 14 filter narrows teams, stock and distributions to one organisation; shelters unchanged', async () => {
    const picture = await service.getCombinedPicture({
      districtId: areas.gampaha.id,
      organisationId: orgs.redCross.id,
    });

    expect(picture.organisation).toEqual({
      id: orgs.redCross.id,
      name: 'Red Cross Sri Lanka',
      type: OrgType.NGO,
    });
    expect(picture.shelters).toHaveLength(3);
    expect(picture.teams).toEqual([]);
    expect(picture.recentDistributions.map((d) => d.organisation.name)).toEqual([
      'Red Cross Sri Lanka',
      'Red Cross Sri Lanka',
    ]);
    expect(picture.totalsByOrganisation).toEqual([
      {
        organisation: { id: orgs.redCross.id, name: 'Red Cross Sri Lanka', type: OrgType.NGO },
        teams: 0,
        stockItems: 1500,
        distributed: 500,
      },
    ]);
    expect(picture.summary).toEqual({
      shelters: 3,
      sheltersNearCapacity: 1,
      teams: 0,
      teamsAvailable: 0,
      suppliesDistributed: 500,
      affectedPeople: 840,
    });
  });

  it('TC-06: an organisation with nothing in the district gives empty teams and totals', async () => {
    const picture = await service.getCombinedPicture({
      districtId: areas.gampaha.id,
      organisationId: orgs.unicef.id,
    });

    expect(picture.teams).toEqual([]);
    expect(picture.recentDistributions).toEqual([]);
    expect(picture.totalsByOrganisation).toEqual([]);
    expect(picture.summary.suppliesDistributed).toBe(0);
  });

  it('TC-04: no ACTIVE incident gives incident null and counts distributions over all time', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.colombo.id });

    expect(picture.incident).toBeNull();
    expect(picture.summary).toMatchObject({ shelters: 1, sheltersNearCapacity: 1, teams: 1 });
    expect(picture.summary.suppliesDistributed).toBe(77);
  });

  it('TC-04: a CLOSED event is not the incident', async () => {
    await HazardEvent.create({
      name: 'Old Colombo flood',
      hazardType: 'FLOOD',
      status: EventStatus.CLOSED,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-10'),
      districts: [areas.colombo._id],
    });

    expect(
      (await service.getCombinedPicture({ districtId: areas.colombo.id })).incident,
    ).toBeNull();
  });

  it('Main 2: an empty district is all zeros and empty lists', async () => {
    const picture = await service.getCombinedPicture({ districtId: areas.kalutara.id });

    expect(picture).toMatchObject({
      shelters: [],
      teams: [],
      recentDistributions: [],
      totalsByOrganisation: [],
      summary: {
        shelters: 0,
        sheltersNearCapacity: 0,
        teams: 0,
        teamsAvailable: 0,
        suppliesDistributed: 0,
        affectedPeople: 0,
      },
    });
  });

  it('Main 2: lists only the 10 most recent supply logs, newest first', async () => {
    for (let day = 1; day <= 12; day += 1) {
      await distribute(
        stock.food,
        shelters.attanagalla,
        day,
        `2026-10-${String(day + 10).padStart(2, '0')}T08:00:00.000Z`,
      );
    }

    const picture = await service.getCombinedPicture({ districtId: areas.gampaha.id });

    expect(picture.recentDistributions).toHaveLength(
      OperationalPictureService.RECENT_DISTRIBUTIONS,
    );
    expect(picture.recentDistributions.map((d) => d.quantity)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ]);
  });

  it('Main 1: refuses an unknown district with 404', async () => {
    await expect(
      service.getCombinedPicture({ districtId: new mongoose.Types.ObjectId().toString() }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'District not found.' });
  });

  it('Main 14: refuses an unknown organisation with 404', async () => {
    await expect(
      service.getCombinedPicture({
        districtId: areas.gampaha.id,
        organisationId: new mongoose.Types.ObjectId().toString(),
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Organisation not found.' });
  });
});
