import { ReportLabels } from '../../../src/domain/reports/ReportLabels.js';

describe('ReportLabels', () => {
  it.each([
    ['RISING_RIVER_FLOOD', 'Rising river / Flood'],
    ['LANDSLIDE', 'Landslide'],
    ['BLOCKED_ROAD', 'Blocked road'],
    ['OTHER', 'Other'],
  ])('Main 9: labels hazard type %s as "%s"', (hazardType, label) => {
    expect(ReportLabels.hazardType(hazardType)).toBe(label);
  });

  it('Main 9: falls back to the raw value for an unknown type', () => {
    expect(ReportLabels.hazardType('TSUNAMI')).toBe('TSUNAMI');
  });
});
