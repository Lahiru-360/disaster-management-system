// UC02 enum values as the console shows them - the same words as the app's
// chips and the server's ReportLabels.
const HAZARD_TYPE_LABELS = Object.freeze({
  RISING_RIVER_FLOOD: 'Rising river / Flood',
  LANDSLIDE: 'Landslide',
  BLOCKED_ROAD: 'Blocked road',
  OTHER: 'Other',
});

// The queue's short form, as the §5.2 wireframe lists them ("GR-2481 Flood").
const HAZARD_TYPE_SHORT = Object.freeze({
  RISING_RIVER_FLOOD: 'Flood',
  LANDSLIDE: 'Landslide',
  BLOCKED_ROAD: 'Blocked road',
  OTHER: 'Other',
});

// How the officer sees where a location came from (UC02 A2.3): "(GPS)" or
// "(Manual)" after the coordinates.
const LOCATION_SOURCE_LABELS = Object.freeze({ GPS: 'GPS', MANUAL: 'Manual' });

export const locationSourceLabel = (value) => LOCATION_SOURCE_LABELS[value] ?? value;
// The four reasons a duty officer can give for dismissing a report (UC02
// A1.1), in the dropdown's order, with the words the reporter also sees.
export const DISMISSAL_REASONS = Object.freeze([
  { value: 'INACCURATE', label: 'Inaccurate' },
  { value: 'DUPLICATE', label: 'Duplicate' },
  { value: 'NOT_A_HAZARD', label: 'Not a hazard' },
  { value: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient evidence' },
]);

export const DISMISSAL_NOTE_MAX_LENGTH = 200;

export const dismissalReasonLabel = (value) =>
  DISMISSAL_REASONS.find((reason) => reason.value === value)?.label ?? value;

export const hazardTypeLabel = (value) => HAZARD_TYPE_LABELS[value] ?? value;
export const hazardTypeShort = (value) => HAZARD_TYPE_SHORT[value] ?? value;

// "6.9382 N, 79.9012 E".
export function formatCoordinates({ latitude, longitude }) {
  const lat = `${Math.abs(latitude).toFixed(4)} ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)} ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

// "10:24 AM", in the officer's own time zone.
export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
