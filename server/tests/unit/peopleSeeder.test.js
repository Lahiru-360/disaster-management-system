import { jest } from '@jest/globals';
import { DistrictSeeder } from '../../scripts/DistrictSeeder.js';
import { PeopleSeeder } from '../../scripts/PeopleSeeder.js';
import { SyntheticCitizenGenerator } from '../../scripts/SyntheticCitizenGenerator.js';
import { Role } from '../../src/enums/Role.js';
import { District } from '../../src/models/District.js';
import { User } from '../../src/models/User.js';

beforeAll(async () => {
  await District.init();
  await User.init();
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const seedAll = async () => {
  await new DistrictSeeder().run();
  await new PeopleSeeder().run();
};

const districtNameOf = async (email, field) => {
  const user = await User.findOne({ email }).populate(field);
  return user[field]?.name;
};

describe('SyntheticCitizenGenerator', () => {
  it('DMS-105: generates 500 citizens with unique synth emails', () => {
    const citizens = SyntheticCitizenGenerator.generate();

    expect(citizens).toHaveLength(500);
    expect(new Set(citizens.map((citizen) => citizen.email)).size).toBe(500);
    expect(citizens[0].email).toBe('citizen.synth.1@example.test');
    expect(citizens[499].email).toBe('citizen.synth.500@example.test');
  });

  it('DMS-105: spreads them over at least 5 districts, most in Colombo then Gampaha', () => {
    const counts = {};
    for (const { homeDistrict } of SyntheticCitizenGenerator.generate()) {
      counts[homeDistrict] = (counts[homeDistrict] ?? 0) + 1;
    }
    const ranked = Object.entries(counts).sort(([, a], [, b]) => b - a);

    expect(ranked.length).toBeGreaterThanOrEqual(5);
    expect(ranked.slice(0, 2).map(([name]) => name)).toEqual(['Colombo', 'Gampaha']);
  });

  it('DMS-105: is deterministic - the same citizens every call', () => {
    expect(SyntheticCitizenGenerator.generate()).toEqual(SyntheticCitizenGenerator.generate());
  });
});

describe('PeopleSeeder', () => {
  it('DMS-105: gives the demo accounts their wireframe districts', async () => {
    await seedAll();

    expect(await districtNameOf('citizen@example.test', 'homeDistrict')).toBe('Colombo');
    expect(await districtNameOf('volunteer@example.test', 'homeDistrict')).toBe('Colombo');
    expect(await districtNameOf('duty.officer@example.test', 'shiftDistrict')).toBe('Colombo');
    expect(await districtNameOf('district.officer@example.test', 'district')).toBe('Gampaha');
  });

  it('DMS-105: leaves the DMC officer and rescue team lead without a district', async () => {
    await seedAll();

    for (const email of ['dmc.officer@example.test', 'rescue.lead@example.test']) {
      const user = await User.findOne({ email }).lean();
      expect(user).not.toHaveProperty('homeDistrict');
      expect(user).not.toHaveProperty('district');
      expect(user).not.toHaveProperty('shiftDistrict');
    }
  });

  it('DMS-105: seeds the 500 synthetic citizens with a home district and phone', async () => {
    await seedAll();

    const synthetic = await User.find({ email: /^citizen\.synth\./ }).lean();
    expect(synthetic).toHaveLength(500);
    expect(synthetic.every((user) => user.role === Role.CITIZEN)).toBe(true);
    expect(synthetic.every((user) => user.homeDistrict && user.phone)).toBe(true);
  });

  it('DMS-105: is idempotent - a second run keeps the same accounts and ids', async () => {
    await seedAll();
    const before = await User.find().sort({ email: 1 }).lean();

    await seedAll();
    const after = await User.find().sort({ email: 1 }).lean();

    expect(after).toHaveLength(506);
    expect(after.map((user) => String(user._id))).toEqual(before.map((user) => String(user._id)));
  });

  it('DMS-105: adds the districts to a demo account seeded before they existed', async () => {
    await new DistrictSeeder().run();
    await User.create({
      name: 'Kasun Silva',
      email: 'duty.officer@example.test',
      passwordHash: 'old-hash',
      role: Role.DUTY_OFFICER,
    });

    await new PeopleSeeder().run();

    const user = await User.findOne({ email: 'duty.officer@example.test' }).populate(
      'shiftDistrict',
    );
    expect(user.shiftDistrict.name).toBe('Colombo');
    expect(user.passwordHash).toBe('old-hash');
  });

  it('DMS-105: stops when the districts have not been seeded', async () => {
    await expect(new PeopleSeeder().run()).rejects.toThrow('run DistrictSeeder first');
    expect(await User.countDocuments()).toBe(0);
  });
});
