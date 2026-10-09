// UC02 hazard types as the app shows them - the chips on the report form and
// the type on My reports. Same values and labels as the server's
// ReportHazardType / ReportLabels. `icon` is the MaterialCommunityIcons name
// shown above the label on the report form.
export const HAZARD_TYPES = Object.freeze([
  { value: 'RISING_RIVER_FLOOD', label: 'Rising river / Flood', icon: 'water' },
  { value: 'LANDSLIDE', label: 'Landslide', icon: 'image-filter-hdr' },
  { value: 'BLOCKED_ROAD', label: 'Blocked road', icon: 'road-variant' },
  { value: 'OTHER', label: 'Other', icon: 'alert-circle' },
]);

export const DESCRIPTION_MAX_LENGTH = 200;

export function hazardTypeLabel(value) {
  return HAZARD_TYPES.find((type) => type.value === value)?.label ?? value;
}

// Why a duty officer dismissed a report, as the reporter sees it - the same
// words as the server's ReportLabels and the officer's dropdown.
const DISMISSAL_REASON_LABELS = Object.freeze({
  INACCURATE: 'Inaccurate',
  DUPLICATE: 'Duplicate',
  NOT_A_HAZARD: 'Not a hazard',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
});

export function dismissalReasonLabel(value) {
  return DISMISSAL_REASON_LABELS[value] ?? value;
}
