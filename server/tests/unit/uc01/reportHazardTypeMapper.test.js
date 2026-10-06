import { AlertHazardType } from '../../../src/enums/AlertHazardType.js';
import { ReportHazardType } from '../../../src/enums/ReportHazardType.js';
import { ReportHazardTypeMapper } from '../../../src/domain/alerts/ReportHazardTypeMapper.js';

describe('ReportHazardTypeMapper', () => {
  it('DMS-122: covers every ReportHazardType, so a new report type cannot be left unmapped', () => {
    expect(ReportHazardTypeMapper.mappedTypes().sort()).toEqual(
      Object.values(ReportHazardType).sort(),
    );
  });

  it.each([
    ['RISING_RIVER_FLOOD', 'FLOOD'],
    ['LANDSLIDE', 'LANDSLIDE'],
    ['BLOCKED_ROAD', null],
    ['OTHER', null],
  ])('DMS-122: TC-16/TC-17 A1 maps %s to %s', (reportType, alertType) => {
    expect(ReportHazardTypeMapper.toAlertHazardType(reportType)).toBe(alertType);
  });

  it('DMS-122: every non-null result is an AlertHazardType', () => {
    for (const reportType of Object.values(ReportHazardType)) {
      const alertType = ReportHazardTypeMapper.toAlertHazardType(reportType);
      if (alertType !== null) {
        expect(Object.values(AlertHazardType)).toContain(alertType);
      }
    }
  });

  it('DMS-122: refuses a value that is not a ReportHazardType', () => {
    expect(() => ReportHazardTypeMapper.toAlertHazardType('FLOOD')).toThrow(
      /unknown report hazard type/,
    );
    expect(() => ReportHazardTypeMapper.toAlertHazardType('toString')).toThrow(/unknown/);
    expect(() => ReportHazardTypeMapper.toAlertHazardType(undefined)).toThrow(/unknown/);
  });
});
