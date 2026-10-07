import { jest } from '@jest/globals';

// Config reads the environment once, at import, so each case loads a fresh copy.
const loadConfigWith = async (vars) => {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  try {
    jest.resetModules();
    return (await import('../../src/config/Config.js')).env;
  } finally {
    process.env = saved;
  }
};

describe('Config demo failure rates (DMS-121)', () => {
  it('Main 13: are 0 when unset or empty', async () => {
    const env = await loadConfigWith({
      DEMO_FAIL_PUSH_RATE: '',
      DEMO_FAIL_SMS_RATE: '',
      DEMO_FAIL_AUDIBLE_RATE: '',
    });

    expect([env.demoFailPushRate, env.demoFailSmsRate, env.demoFailAudibleRate]).toEqual([0, 0, 0]);
  });

  it('Main 13: read a share from 0 to 1', async () => {
    const env = await loadConfigWith({
      DEMO_FAIL_PUSH_RATE: '0.25',
      DEMO_FAIL_SMS_RATE: '1',
      DEMO_FAIL_AUDIBLE_RATE: '0',
    });

    expect([env.demoFailPushRate, env.demoFailSmsRate, env.demoFailAudibleRate]).toEqual([
      0.25, 1, 0,
    ]);
  });

  it.each(['1.5', '-0.1', 'half'])('Main 13: refuse %s at startup', async (value) => {
    await expect(loadConfigWith({ DEMO_FAIL_PUSH_RATE: value })).rejects.toThrow(
      'DEMO_FAIL_PUSH_RATE must be a number from 0 to 1',
    );
  });
});
