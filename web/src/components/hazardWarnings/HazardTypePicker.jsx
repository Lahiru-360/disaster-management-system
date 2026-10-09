import { Droplet, Mountain, Sun, Wind } from 'lucide-react';

export const HAZARD_TYPES = [
  { value: 'FLOOD', label: 'Flood', Icon: Droplet },
  { value: 'LANDSLIDE', label: 'Landslide', Icon: Mountain },
  { value: 'CYCLONE', label: 'Cyclone', Icon: Wind },
  { value: 'DROUGHT', label: 'Drought', Icon: Sun },
];

// UC01 step 3: exactly one hazard type (the AlertHazardType values), as a row
// of tiles with an icon above the label. Clicking the chosen tile again keeps
// it chosen.
export default function HazardTypePicker({ value, onChange }) {
  return (
    <div role="group" aria-label="Hazard type" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {HAZARD_TYPES.map(({ value: type, label, Icon }) => {
        const active = value === type;

        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(type)}
            className={[
              'flex h-24 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border text-[14px] transition-colors',
              'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
              active
                ? 'border-navy bg-navy-soft font-semibold text-navy'
                : 'border-line bg-haze/60 font-medium text-muted hover:bg-haze',
            ].join(' ')}
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
