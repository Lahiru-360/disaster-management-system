// UC04 post-event reports (docs/api-contract.md §14): the four sections a
// report can hold, in report order, with the titles the view and the
// parameter screen show.
export const REPORT_SECTIONS = Object.freeze([
  { key: 'alertTimeline', title: 'Alert timeline' },
  { key: 'citizensReached', title: 'Citizens reached' },
  { key: 'occupancyOverTime', title: 'Shelter occupancy' },
  { key: 'resourceDistribution', title: 'Resource distribution' },
]);

export const SECTION_KEYS = REPORT_SECTIONS.map((section) => section.key);

export function sectionTitle(key) {
  return REPORT_SECTIONS.find((section) => section.key === key)?.title ?? key;
}

// UC01's delivery channels, in the order every report lists them.
export const CHANNELS = Object.freeze(['PUSH', 'SMS', 'AUDIBLE']);

export const CHANNEL_LABELS = Object.freeze({ PUSH: 'Push', SMS: 'SMS', AUDIBLE: 'Audible' });

// UC01's SeverityLevel, lowest first.
export const SEVERITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'SEVERE']);

// UC01's AlertHazardType, the values the A1 hazard filter takes (§14.12).
export const ALERT_HAZARD_TYPES = Object.freeze([
  { value: 'FLOOD', label: 'Flood' },
  { value: 'LANDSLIDE', label: 'Landslide' },
  { value: 'CYCLONE', label: 'Cyclone' },
  { value: 'DROUGHT', label: 'Drought' },
]);

// The A1 filters each section is narrowed by (§14.12), as the server's
// sections declare them; a section ignores any other filter that is set.
export const SECTION_FILTERS = Object.freeze({
  alertTimeline: ['districtId', 'hazardType'],
  citizensReached: ['districtId', 'hazardType'],
  occupancyOverTime: ['districtId'],
  resourceDistribution: ['districtId', 'organisationId'],
});

export const FILTER_NAMES = Object.freeze({
  hazardType: 'hazard',
  districtId: 'district',
  organisationId: 'organisation',
});

export const NO_FILTERS = Object.freeze({
  hazardType: null,
  districtId: null,
  organisationId: null,
});
