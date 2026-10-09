import { Config } from '../../../src/config/Config.js';

const KEY = 'DISPATCH_ACK_TIMEOUT_MINUTES';
let saved;

beforeEach(() => {
  saved = process.env[KEY];
});

afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
});

describe('Config.dispatchAckTimeoutMinutes', () => {
  it.each([undefined, '', '  '])('TC-18: defaults to 5 minutes when unset (%p)', (value) => {
    if (value === undefined) delete process.env[KEY];
    else process.env[KEY] = value;

    expect(new Config().dispatchAckTimeoutMinutes).toBe(5);
  });

  it('TC-19: reads a configured deadline, e.g. 2 minutes', () => {
    process.env[KEY] = '2';

    expect(new Config().dispatchAckTimeoutMinutes).toBe(2);
  });

  it.each(['0', '-3', '2.5', 'five'])('Main 9: refuses %p at startup', (value) => {
    process.env[KEY] = value;

    expect(() => new Config()).toThrow(
      `${KEY} must be a whole number of minutes, 1 or more (got "${value}")`,
    );
  });
});
