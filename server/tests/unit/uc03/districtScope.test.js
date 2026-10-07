import mongoose from 'mongoose';
import { Role } from '../../../src/enums/Role.js';
import { DistrictScope } from '../../../src/services/DistrictScope.js';
import { seedAreas } from '../../helpers/areaFixtures.js';
import { createUser } from '../../helpers/userFactory.js';

const scope = new DistrictScope();
let areas;

beforeEach(async () => {
  areas = await seedAreas();
});

describe('DistrictScope.readableDistrict', () => {
  it('Main 1: a district officer reads their own district when none is named', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    await expect(scope.readableDistrict(officer)).resolves.toBe(areas.gampaha.id);
  });

  it('Main 1: a district officer may name their own district', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    await expect(scope.readableDistrict(officer, areas.gampaha.id)).resolves.toBe(areas.gampaha.id);
  });

  it('TC-02: a district officer naming another district is refused with 403', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    await expect(scope.readableDistrict(officer, areas.colombo.id)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You can only coordinate your own district.',
    });
  });

  it('Main 1: a district officer with no district on their profile is refused with 403', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER });

    await expect(scope.readableDistrict(officer)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'No district is assigned to your account.',
    });
  });

  it.each([Role.DMC_OFFICER, Role.DUTY_OFFICER])(
    'Main 14: a %s may read any district they name',
    async (role) => {
      const officer = await createUser({ role });

      await expect(scope.readableDistrict(officer, areas.colombo.id)).resolves.toBe(
        areas.colombo.id,
      );
    },
  );

  it('Main 14: a DMC officer must name a district', async () => {
    const officer = await createUser({ role: Role.DMC_OFFICER });

    await expect(scope.readableDistrict(officer)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'districtId', message: 'districtId is required' }],
    });
  });

  it('Main 14: a DMC officer naming an unknown district gets 404', async () => {
    const officer = await createUser({ role: Role.DMC_OFFICER });

    await expect(
      scope.readableDistrict(officer, new mongoose.Types.ObjectId().toString()),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it.each([Role.CITIZEN, Role.RESCUE_TEAM_LEAD])('TC-03: a %s reads no district', async (role) => {
    const user = await createUser({ role });

    await expect(scope.readableDistrict(user, areas.gampaha.id)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

describe('DistrictScope.assertOwnDistrict', () => {
  it('TC-29: lets a district officer act on a record in their district', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    expect(() => scope.assertOwnDistrict(officer, areas.gampaha._id)).not.toThrow();
  });

  it('TC-29: refuses a record in another district with 403', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    expect(() => scope.assertOwnDistrict(officer, areas.colombo._id)).toThrow(
      'You can only coordinate your own district.',
    );
  });

  it('TC-29: refuses anyone who is not a district officer', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    expect(() => scope.assertOwnDistrict(dmc, areas.gampaha._id)).toThrow(
      'You do not have permission to perform this action.',
    );
  });
});

describe('DistrictScope.ownDistrict', () => {
  it('TC-30: is the district on a district officer’s profile', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER, district: areas.gampaha });

    expect(scope.ownDistrict(officer)).toBe(areas.gampaha.id);
  });

  it('refuses a district officer with no district', async () => {
    const officer = await createUser({ role: Role.DISTRICT_OFFICER });

    expect(() => scope.ownDistrict(officer)).toThrow('No district is assigned to your account.');
  });

  it('refuses anyone who is not a district officer', async () => {
    const dmc = await createUser({ role: Role.DMC_OFFICER });

    expect(() => scope.ownDistrict(dmc)).toThrow(
      'You do not have permission to perform this action.',
    );
  });
});
