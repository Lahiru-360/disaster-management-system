import { AlertHazardType } from '../../../src/enums/AlertHazardType.js';
import { SeverityLevel } from '../../../src/enums/SeverityLevel.js';
import { MessageTemplate } from '../../../src/domain/alerts/MessageTemplate.js';

const everyCombination = Object.values(AlertHazardType).flatMap((type) =>
  Object.values(SeverityLevel).map((severity) => [type, severity]),
);

describe('MessageTemplate', () => {
  it('Main 7: TC-06 has a message for all 16 type × severity combinations, each ≤160 characters', () => {
    expect(everyCombination).toHaveLength(16);
    for (const [type, severity] of everyCombination) {
      const message = MessageTemplate.generate(type, severity);
      expect(message.length).toBeGreaterThan(0);
      expect(message.length).toBeLessThanOrEqual(MessageTemplate.MAX_LENGTH);
    }
  });

  it.each(everyCombination)(
    'Main 7: the %s / %s message names its type and severity',
    (type, severity) => {
      const message = MessageTemplate.generate(type, severity);
      const label = type.charAt(0) + type.slice(1).toLowerCase();

      expect(message.startsWith(`${label} Warning: ${severity}. `)).toBe(true);
    },
  );

  it('Main 7: matches the wireframe example for a SEVERE flood', () => {
    expect(MessageTemplate.generate('FLOOD', 'SEVERE')).toBe(
      'Flood Warning: SEVERE. Move to higher ground and follow official guidance.',
    );
  });

  it('Main 7: HIGH and SEVERE say to act now; LOW and MEDIUM say to be ready', () => {
    expect(MessageTemplate.generate('LANDSLIDE', 'HIGH')).toContain('Leave steep slopes now');
    expect(MessageTemplate.generate('LANDSLIDE', 'MEDIUM')).toContain('be ready to leave');
  });

  it.each(Object.values(AlertHazardType))(
    'A3: the %s all-clear names its type and fits in one SMS',
    (type) => {
      const label = type.charAt(0) + type.slice(1).toLowerCase();
      const message = MessageTemplate.allClear(type);

      expect(message).toBe(
        `ALL CLEAR: The ${label} warning has ended. It is now safe, but follow official guidance.`,
      );
      expect(message.length).toBeLessThanOrEqual(MessageTemplate.MAX_LENGTH);
      expect(MessageTemplate.allClearTitle(type)).toBe(`${label} Warning: ALL CLEAR`);
    },
  );

  it('A3: the all-clear refuses an unknown type', () => {
    expect(() => MessageTemplate.allClear('TSUNAMI')).toThrow('unknown hazard type');
    expect(() => MessageTemplate.allClearTitle('TSUNAMI')).toThrow('unknown hazard type');
  });

  it('Main 7: refuses an unknown type or severity', () => {
    expect(() => MessageTemplate.generate('RISING_RIVER_FLOOD', 'LOW')).toThrow(
      'unknown hazard type',
    );
    expect(() => MessageTemplate.generate('FLOOD', 'EXTREME')).toThrow('unknown severity');
  });
});
