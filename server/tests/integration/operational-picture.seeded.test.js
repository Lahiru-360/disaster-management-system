import { jest } from '@jest/globals';
import request from 'supertest';
import { DistrictSeeder } from '../../scripts/DistrictSeeder.js';
import { HazardEventSeeder } from '../../scripts/HazardEventSeeder.js';
import { OrganisationSeeder } from '../../scripts/OrganisationSeeder.js';
import { Uc03Seeder } from '../../scripts/Uc03Seeder.js';
import { app } from '../../src/core/App.js';
import { Role } from '../../src/enums/Role.js';
import { District } from '../../src/models/District.js';
import { bearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// Demo-ready check (PMP DoD): the dashboard endpoint works on what
// `npm run seed` creates, signed in as the demo district officer.
let officer;

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  await new DistrictSeeder().run();
  await new OrganisationSeeder().run();
  await new HazardEventSeeder().run();
  const gampaha = await District.findOne({ name: 'Gampaha' });
  officer = await createUser({
    role: Role.DISTRICT_OFFICER,
    email: 'district.officer@example.test',
    district: gampaha,
  });
  await createUser({ role: Role.RESCUE_TEAM_LEAD, email: 'rescue.lead@example.test' });
  await new Uc03Seeder().run();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/operational-picture on the seeded demo data', () => {
  it('TC-01: the demo district officer sees the Gampaha flood dashboard from the hi-fi', async () => {
    const res = await request(app)
      .get('/api/operational-picture')
      .set('Authorization', bearerFor(officer));

    expect(res.status).toBe(200);
    expect(res.body.data.district.name).toBe('Gampaha');
    expect(res.body.data.incident.name).toBe('Flood – Gampaha District');
    expect(res.body.data.summary).toEqual({
      shelters: 5,
      sheltersNearCapacity: 1,
      teams: 5,
      teamsAvailable: 5,
      suppliesDistributed: 1000,
      affectedPeople: 1184,
    });
    expect(res.body.data.recentDistributions[0]).toMatchObject({
      supplyType: 'WATER',
      quantity: 500,
      unit: 'bottles',
      shelter: { name: 'Gampaha Central College' },
      organisation: { name: 'Red Cross Sri Lanka' },
    });
    expect(res.body.data.totalsByOrganisation.map((row) => row.organisation.name)).toEqual([
      'ADRA',
      'Fire Service',
      'Government/DMC',
      'Red Cross Sri Lanka',
      'SL Army',
      'Sri Lanka Police',
      'UNICEF Sri Lanka',
    ]);
  });
});
