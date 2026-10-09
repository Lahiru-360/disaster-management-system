export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];

// The selected button's colours, one tone per level as in the hi-fi: SEVERE
// in the danger tone.
const SELECTED_STYLES = {
  LOW: 'border-navy bg-navy text-paper',
  MEDIUM: 'border-warning bg-warning text-paper',
  HIGH: 'border-caution bg-caution text-paper',
  SEVERE: 'border-danger bg-danger text-paper',
};

// UC01 step 4: exactly one severity level (the SeverityLevel values), as four
// equal buttons.
export default function SeverityPicker({ value, onChange }) {
  return (
    <div role="group" aria-label="Severity" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SEVERITIES.map((severity) => {
        const active = value === severity;

        return (
          <button
            key={severity}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(severity)}
            className={[
              'h-12 cursor-pointer rounded-xl border text-[14px] font-bold tracking-wide transition-colors',
              'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
              active
                ? SELECTED_STYLES[severity]
                : 'border-line bg-haze/60 text-muted hover:bg-haze',
            ].join(' ')}
          >
            {severity}
          </button>
        );
      })}
    </div>
  );
}
