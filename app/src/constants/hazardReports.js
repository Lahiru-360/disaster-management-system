// UC02 hazard types as the app shows them - the chips on the report form and
// the type on My reports. Same values and labels as the server's
// ReportHazardType / ReportLabels.
export const HAZARD_TYPES = Object.freeze([
  { value: 'RISING_RIVER_FLOOD', label: 'Rising river / Flood' },
  { value: 'LANDSLIDE', label: 'Landslide' },
  { value: 'BLOCKED_ROAD', label: 'Blocked road' },
  { value: 'OTHER', label: 'Other' },
]);

export const DESCRIPTION_MAX_LENGTH = 200;

export function hazardTypeLabel(value) {
  return HAZARD_TYPES.find((type) => type.value === value)?.label ?? value;
}
