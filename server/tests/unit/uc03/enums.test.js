import { DispatchStatus } from '../../../src/enums/DispatchStatus.js';
import { Priority } from '../../../src/enums/Priority.js';
import { ShelterStatus } from '../../../src/enums/ShelterStatus.js';
import { SupplyType } from '../../../src/enums/SupplyType.js';
import { TeamStatus } from '../../../src/enums/TeamStatus.js';

// The values must match the UC03 class diagram exactly, in its order; UNASSIGNED
// is the one addition (E3, deviation log).
describe('UC03 enums', () => {
  it.each([
    ['ShelterStatus', ShelterStatus, ['AVAILABLE', 'FILLING_UP', 'NEAR_CAPACITY', 'FULL']],
    ['TeamStatus', TeamStatus, ['AVAILABLE', 'DISPATCHED', 'ON_SITE', 'UNAVAILABLE']],
    [
      'DispatchStatus',
      DispatchStatus,
      [
        'ASSIGNED',
        'ACKNOWLEDGED',
        'ON_SITE',
        'COMPLETED',
        'DECLINED',
        'UNRESPONSIVE',
        'UNASSIGNED',
      ],
    ],
    ['Priority', Priority, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']],
    ['SupplyType', SupplyType, ['FOOD', 'WATER', 'MEDICINE', 'BLANKETS', 'HYGIENE_KITS']],
  ])('Domain: %s has exactly the class diagram values', (_name, enumeration, values) => {
    expect(Object.values(enumeration)).toEqual(values);
    expect(Object.keys(enumeration)).toEqual(values);
  });

  it.each([ShelterStatus, TeamStatus, DispatchStatus, Priority, SupplyType])(
    'Domain: enum %# cannot be changed at runtime',
    (enumeration) => {
      expect(Object.isFrozen(enumeration)).toBe(true);
    },
  );
});
