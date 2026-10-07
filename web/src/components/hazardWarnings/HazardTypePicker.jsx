import ChipGroup from '../ui/ChipGroup';

export const HAZARD_TYPES = [
  { value: 'FLOOD', label: 'Flood' },
  { value: 'LANDSLIDE', label: 'Landslide' },
  { value: 'CYCLONE', label: 'Cyclone' },
  { value: 'DROUGHT', label: 'Drought' },
];

// UC01 step 3: exactly one hazard type (the AlertHazardType values).
export default function HazardTypePicker({ value, onChange }) {
  return (
    <ChipGroup
      aria-label="Hazard type"
      options={HAZARD_TYPES}
      value={value}
      // A second click would clear the choice; the type stays chosen instead.
      onChange={(next) => next && onChange(next)}
    />
  );
}
