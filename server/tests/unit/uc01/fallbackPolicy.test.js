import { FallbackPolicy, fallbackPolicy } from '../../../src/domain/alerts/FallbackPolicy.js';

describe('FallbackPolicy', () => {
  it('DMS-128: allows 3 attempts in total through SMS by default', () => {
    expect(FallbackPolicy.MAX_ATTEMPTS).toBe(3);
    expect(fallbackPolicy.channel).toBe('SMS');
    expect(fallbackPolicy.maxAttempts).toBe(3);
  });

  it('DMS-128: TC-40 allows a resend after attempts 1 and 2, never after the third', () => {
    expect([1, 2, 3, 4].map((attempts) => fallbackPolicy.allowsResend(attempts))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('DMS-128: takes another limit and channel', () => {
    const policy = new FallbackPolicy({ maxAttempts: 1, channel: 'PUSH' });

    expect(policy.channel).toBe('PUSH');
    expect(policy.allowsResend(1)).toBe(false);
  });

  it.each([0, -1, 2.5, '3'])('DMS-128: refuses maxAttempts %p', (maxAttempts) => {
    expect(() => new FallbackPolicy({ maxAttempts })).toThrow(/positive integer/);
  });

  it('DMS-128: refuses a channel that is not a Channel', () => {
    expect(() => new FallbackPolicy({ channel: 'EMAIL' })).toThrow(/unknown channel "EMAIL"/);
  });
});
