import { DismissalReason } from '../../../src/enums/DismissalReason.js';
import { LocationSource } from '../../../src/enums/LocationSource.js';
import { ReportHazardType } from '../../../src/enums/ReportHazardType.js';
import { ReportStatus } from '../../../src/enums/ReportStatus.js';

// The values are the strings stored and sent over the API (api-contract §9.1),
// so a rename here is a contract change.
const cases = [
  [
    'ReportHazardType',
    ReportHazardType,
    ['RISING_RIVER_FLOOD', 'LANDSLIDE', 'BLOCKED_ROAD', 'OTHER'],
  ],
  ['ReportStatus', ReportStatus, ['PENDING', 'CONFIRMED', 'DISMISSED']],
  ['LocationSource', LocationSource, ['GPS', 'MANUAL']],
  [
    'DismissalReason',
    DismissalReason,
    ['INACCURATE', 'DUPLICATE', 'NOT_A_HAZARD', 'INSUFFICIENT_EVIDENCE'],
  ],
];

describe.each(cases)('%s', (name, enumObject, expectedValues) => {
  it(`DMS-130: holds exactly the contract's ${name} values`, () => {
    expect(Object.values(enumObject)).toEqual(expectedValues);
  });

  it(`DMS-130: maps each ${name} key to the same string`, () => {
    for (const [key, value] of Object.entries(enumObject)) {
      expect(value).toBe(key);
    }
  });

  it(`DMS-130: ${name} is frozen`, () => {
    expect(Object.isFrozen(enumObject)).toBe(true);
  });
});
