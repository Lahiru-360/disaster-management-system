import { SystemClock, systemClock } from '../../src/utils/SystemClock.js';

describe('SystemClock', () => {
  it('DMS-103: now() returns the current wall-clock time as a Date', () => {
    const before = Date.now();
    const now = systemClock.now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it('DMS-103: returns a new Date each call, so a caller cannot change the next one', () => {
    const first = systemClock.now();
    first.setFullYear(2000);

    expect(systemClock.now().getFullYear()).not.toBe(2000);
  });

  it('DMS-103: exports a shared instance of the class', () => {
    expect(systemClock).toBeInstanceOf(SystemClock);
  });
});
