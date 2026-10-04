import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { DatabaseSeeder } from '../../scripts/DatabaseSeeder.js';
import { Seeder } from '../../scripts/Seeder.js';
import { District } from '../../src/models/District.js';
import { User } from '../../src/models/User.js';

// The runner's own behaviour - order, --only and --reset-demo - checked with
// seeders that only record that they ran, so no demo data is involved.

const DemoThing = mongoose.model('SeederTestDemoThing', new mongoose.Schema({ label: String }));

class RecordingSeeder extends Seeder {
  constructor(name, calls, demoModels = []) {
    super();
    this.key = name;
    this.calls = calls;
    this.models = demoModels;
  }

  get name() {
    return this.key;
  }

  get demoModels() {
    return this.models;
  }

  async run() {
    this.calls.push(this.key);
  }
}

class HazardEventSeeder extends Seeder {}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const recorders = (names, calls) => names.map((name) => new RecordingSeeder(name, calls));

describe('DatabaseSeeder.parseArgs', () => {
  it('DMS-110: seeds everything without flags', () => {
    expect(DatabaseSeeder.parseArgs([])).toEqual({ only: null, resetDemo: false });
  });

  it('DMS-110: reads --only as one name or a comma-separated list', () => {
    expect(DatabaseSeeder.parseArgs(['--only=uc03']).only).toEqual(['uc03']);
    expect(DatabaseSeeder.parseArgs(['--only=uc03, uc04']).only).toEqual(['uc03', 'uc04']);
  });

  it('DMS-110: reads --reset-demo alongside --only', () => {
    expect(DatabaseSeeder.parseArgs(['--reset-demo', '--only=uc04'])).toEqual({
      only: ['uc04'],
      resetDemo: true,
    });
  });

  it('DMS-110: rejects an empty --only', () => {
    expect(() => DatabaseSeeder.parseArgs(['--only='])).toThrow('--only needs at least one');
  });

  it('DMS-110: rejects an unknown flag', () => {
    expect(() => DatabaseSeeder.parseArgs(['--reset'])).toThrow('Unknown option "--reset"');
  });
});

describe('Seeder', () => {
  it('DMS-110: cannot be used without a subclass', () => {
    expect(() => new Seeder()).toThrow('Seeder is abstract');
  });

  it('DMS-110: names a seeder after its class in kebab case', () => {
    expect(new HazardEventSeeder().name).toBe('hazard-event');
  });

  it('DMS-110: has no demo collections and no run() of its own', async () => {
    const seeder = new HazardEventSeeder();

    expect(seeder.demoModels).toEqual([]);
    await expect(seeder.run()).rejects.toThrow('HazardEventSeeder must implement run()');
  });
});

describe('DatabaseSeeder.seed', () => {
  // Read through an unknown --only name's error, which lists the default
  // seeders in order without running any of them.
  it('DMS-110: runs District → People → UC01 → UC02 → UC03 → UC04 by default', async () => {
    await expect(new DatabaseSeeder().seed({ only: ['?'] })).rejects.toThrow(
      'choose from district, people, uc01, uc02, uc03, uc04',
    );
  });

  it('DMS-110: runs every seeder in the given order', async () => {
    const calls = [];
    await new DatabaseSeeder(recorders(['district', 'people', 'uc01'], calls)).seed();

    expect(calls).toEqual(['district', 'people', 'uc01']);
  });

  it('DMS-110: --only runs just the named seeders, still in order', async () => {
    const calls = [];
    await new DatabaseSeeder(recorders(['district', 'people', 'uc03', 'uc04'], calls)).seed({
      only: ['uc04', 'uc03'],
    });

    expect(calls).toEqual(['uc03', 'uc04']);
  });

  it('DMS-110: an unknown --only name runs nothing and lists the choices', async () => {
    const calls = [];
    const seeder = new DatabaseSeeder(recorders(['district', 'uc03'], calls));

    await expect(seeder.seed({ only: ['uc3'] })).rejects.toThrow(
      'Unknown seeder "uc3" - choose from district, uc03',
    );
    expect(calls).toEqual([]);
  });

  it("DMS-110: --reset-demo empties the selected seeders' collections, then reseeds", async () => {
    await DemoThing.create({ label: 'left over from a rehearsal' });
    const calls = [];
    const uc04 = new RecordingSeeder('uc04', calls, [DemoThing]);
    uc04.run = async () => {
      calls.push(await DemoThing.countDocuments());
      await DemoThing.create({ label: 'fresh' });
    };

    await new DatabaseSeeder([uc04]).seed({ resetDemo: true });

    expect(calls).toEqual([0]);
    expect((await DemoThing.find().lean()).map((thing) => thing.label)).toEqual(['fresh']);
  });

  it("DMS-110: --reset-demo with --only leaves other seeders' collections alone", async () => {
    await DemoThing.create({ label: 'uc03 data' });
    const calls = [];
    const seeders = [
      new RecordingSeeder('uc03', calls, [DemoThing]),
      new RecordingSeeder('uc04', calls),
    ];

    await new DatabaseSeeder(seeders).seed({ only: ['uc04'], resetDemo: true });

    expect(calls).toEqual(['uc04']);
    expect(await DemoThing.countDocuments()).toBe(1);
  });

  it('DMS-110: seeding without --reset-demo never deletes anything', async () => {
    await DemoThing.create({ label: 'kept' });

    await new DatabaseSeeder([new RecordingSeeder('uc04', [], [DemoThing])]).seed();

    expect(await DemoThing.countDocuments()).toBe(1);
  });

  it.each([
    ['User', User],
    ['District', District],
  ])('DMS-110: --reset-demo refuses to wipe %s, before deleting anything', async (_n, Model) => {
    await DemoThing.create({ label: 'kept' });
    const calls = [];
    const seeders = [
      new RecordingSeeder('uc03', calls, [DemoThing]),
      new RecordingSeeder('uc04', calls, [Model]),
    ];

    await expect(new DatabaseSeeder(seeders).seed({ resetDemo: true })).rejects.toThrow(
      `RecordingSeeder may not reset ${Model.modelName}`,
    );
    expect(await DemoThing.countDocuments()).toBe(1);
    expect(calls).toEqual([]);
  });
});
