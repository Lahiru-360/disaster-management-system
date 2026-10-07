import { AlertHazardType } from '../../../src/enums/AlertHazardType.js';
import { AlertStatus } from '../../../src/enums/AlertStatus.js';
import { Channel } from '../../../src/enums/Channel.js';
import { DeliveryStatus } from '../../../src/enums/DeliveryStatus.js';
import { NotificationKind } from '../../../src/enums/NotificationKind.js';
import { SeverityLevel } from '../../../src/enums/SeverityLevel.js';

// The values are the strings stored and sent over the API (api-contract §8),
// so a rename here is a contract change.
const cases = [
  ['AlertHazardType', AlertHazardType, ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT']],
  ['SeverityLevel', SeverityLevel, ['LOW', 'MEDIUM', 'HIGH', 'SEVERE']],
  ['AlertStatus', AlertStatus, ['DRAFT', 'BROADCAST', 'UPDATED', 'CANCELLED']],
  ['Channel', Channel, ['PUSH', 'SMS', 'AUDIBLE']],
  ['DeliveryStatus', DeliveryStatus, ['QUEUED', 'SENT', 'DELIVERED', 'FAILED']],
  ['NotificationKind', NotificationKind, ['WARNING', 'UPDATE', 'ALL_CLEAR']],
];

describe.each(cases)('%s', (name, enumObject, expectedValues) => {
  it(`Domain: holds exactly the class diagram's ${name} values`, () => {
    expect(Object.values(enumObject)).toEqual(expectedValues);
  });

  it(`Domain: maps each ${name} key to the same string`, () => {
    for (const [key, value] of Object.entries(enumObject)) {
      expect(value).toBe(key);
    }
  });

  it(`Domain: ${name} is frozen`, () => {
    expect(Object.isFrozen(enumObject)).toBe(true);
  });
});
