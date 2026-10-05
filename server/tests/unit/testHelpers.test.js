import mongoose from 'mongoose';
import { Role } from '../../src/enums/Role.js';
import { User } from '../../src/models/User.js';
import { tokenService } from '../../src/services/TokenService.js';
import { accessTokenFor, bearerFor, expiredBearerFor } from '../helpers/authHelper.js';
import { createUser } from '../helpers/userFactory.js';

// The shared helpers are test code, so they aren't covered by the coverage
// gate; these prove they do what their JSDoc says.

beforeAll(async () => {
  await User.init();
});

describe('userFactory.createUser', () => {
  it('DMS-103: creates a citizen by default, with a unique email each time', async () => {
    const first = await createUser();
    const second = await createUser();

    expect(first.role).toBe(Role.CITIZEN);
    expect(first.email).not.toBe(second.email);
    expect(await User.countDocuments()).toBe(2);
  });

  it('DMS-103: creates any role with the district fields, from a document or an id', async () => {
    const colombo = { _id: new mongoose.Types.ObjectId() };
    const gampahaId = new mongoose.Types.ObjectId();

    const dutyOfficer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: colombo });
    const districtOfficer = await createUser({ role: Role.DISTRICT_OFFICER, district: gampahaId });
    const citizen = await createUser({ homeDistrict: colombo, phone: '0771234567' });

    expect(dutyOfficer.shiftDistrict).toEqual(colombo._id);
    expect(districtOfficer.district).toEqual(gampahaId);
    expect(citizen.homeDistrict).toEqual(colombo._id);
    expect(citizen.phone).toBe('0771234567');
  });

  it('DMS-103: lets a test override any other field', async () => {
    const user = await createUser({
      name: 'Kasun Silva',
      email: 'kasun@example.test',
      isActive: false,
    });

    expect(user).toMatchObject({
      name: 'Kasun Silva',
      email: 'kasun@example.test',
      isActive: false,
    });
  });
});

describe('authHelper', () => {
  it('DMS-103: signs a token TokenService accepts, with the user id and role', async () => {
    const user = await createUser({ role: Role.DMC_OFFICER });

    expect(tokenService.verifyAccessToken(accessTokenFor(user))).toMatchObject({
      id: user.id,
      role: Role.DMC_OFFICER,
    });
  });

  it('DMS-103: bearerFor prefixes the token with "Bearer "', async () => {
    const user = await createUser();
    const [scheme, token] = bearerFor(user).split(' ');

    expect(scheme).toBe('Bearer');
    expect(tokenService.verifyAccessToken(token).id).toBe(user.id);
  });

  it('DMS-103: expiredBearerFor gives a token TokenService rejects as expired', async () => {
    const token = expiredBearerFor(await createUser()).split(' ')[1];

    expect(() => tokenService.verifyAccessToken(token)).toThrow(
      expect.objectContaining({ name: 'TokenExpiredError' }),
    );
  });
});
