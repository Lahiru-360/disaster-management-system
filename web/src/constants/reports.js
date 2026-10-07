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
