export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];

// The selected chip's colours: SEVERE in the danger tone, as in the hi-fi.
const SELECTED_STYLES = {
  SEVERE: 'border-danger bg-danger text-paper',
};
const DEFAULT_SELECTED = 'border-navy bg-navy text-paper';

// UC01 step 4: exactly one severity level (the SeverityLevel values). Chips
// like ui/ChipGroup's, but with a tone per level, which ChipGroup lacks.
export default function SeverityPicker({ value, onChange }) {
  return (
    <div role="group" aria-label="Severity" className="flex flex-wrap gap-2">
      {SEVERITIES.map((severity) => {
        const active = value === severity;

        return (
          <button
            key={severity}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(severity)}
            className={[
              'h-8 rounded-full border px-3.5 text-[13px] font-bold tracking-wide transition-colors',
              'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
              active
                ? (SELECTED_STYLES[severity] ?? DEFAULT_SELECTED)
                : 'border-line bg-paper text-ink hover:bg-haze',
            ].join(' ')}
          >
            {severity}
          </button>
        );
      })}
    </div>
  );
}
