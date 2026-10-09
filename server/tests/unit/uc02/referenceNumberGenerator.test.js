import { Counter } from '../../../src/models/Counter.js';
import {
  ReferenceNumberGenerator,
  referenceNumberGenerator,
} from '../../../src/services/ReferenceNumberGenerator.js';

beforeAll(async () => {
  await Counter.init();
});

describe('ReferenceNumberGenerator', () => {
  it('DMS-130: starts at GR-0001 and counts up', async () => {
    const generator = new ReferenceNumberGenerator();

    expect(await generator.next()).toBe('GR-0001');
    expect(await generator.next()).toBe('GR-0002');
    expect(await generator.next()).toBe('GR-0003');
  });

  it('DMS-130: keeps counting from the stored counter across instances', async () => {
    await new ReferenceNumberGenerator().next();

    expect(await referenceNumberGenerator.next()).toBe('GR-0002');
  });

  it('DMS-130: hands out unique numbers to concurrent submits', async () => {
    const generator = new ReferenceNumberGenerator();

    const numbers = await Promise.all(Array.from({ length: 25 }, () => generator.next()));

    expect(new Set(numbers).size).toBe(25);
    expect([...numbers].sort().at(-1)).toBe('GR-0025');
    expect(await Counter.countDocuments()).toBe(1);
  });

  it('DMS-130: pads to four digits and never cuts a longer number', () => {
    const generator = new ReferenceNumberGenerator();

    expect(generator.format(7)).toBe('GR-0007');
    expect(generator.format(2481)).toBe('GR-2481');
    expect(generator.format(12345)).toBe('GR-12345');
  });

  it('DMS-130: reserveUpTo skips numbers already in use', async () => {
    const generator = new ReferenceNumberGenerator();

    await generator.reserveUpTo(2481);

    expect(await generator.next()).toBe('GR-2482');
  });

  it('DMS-130: reserveUpTo never moves the counter back', async () => {
    const generator = new ReferenceNumberGenerator();
    await generator.reserveUpTo(2481);

    await generator.reserveUpTo(10);

    expect(await generator.next()).toBe('GR-2482');
  });

  it('DMS-130: keeps separate sequences apart, with its own prefix and width', async () => {
    const reports = new ReferenceNumberGenerator();
    const other = new ReferenceNumberGenerator({ counterName: 'other', prefix: 'X', digits: 2 });

    await reports.next();
    await reports.next();

    expect(await other.next()).toBe('X-01');
    expect(await reports.next()).toBe('GR-0003');
  });
});

describe('Counter model', () => {
  it('DMS-130: refuses two counters with the same name', async () => {
    await Counter.create({ name: 'hazardReport' });

    await expect(Counter.create({ name: 'hazardReport' })).rejects.toMatchObject({ code: 11000 });
  });

  it('DMS-130: starts a counter at 0 and refuses a negative one', async () => {
    expect((await Counter.create({ name: 'fresh' })).seq).toBe(0);
    await expect(Counter.create({ name: 'neg', seq: -1 })).rejects.toThrow('seq');
  });
});
