// Ordered low-to-high; the first threshold whose `upTo` the percentage
// doesn't exceed wins. Callers needing different cutoffs (e.g. the shelter
// occupancy bands) pass their own `thresholds`.
const DEFAULT_THRESHOLDS = [
  { upTo: 70, tone: 'success' },
  { upTo: 90, tone: 'warning' },
  { upTo: Infinity, tone: 'danger' },
];

const TONE_FILL = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-navy',
  neutral: 'bg-muted',
};

function toneForPercent(percent, thresholds) {
  return thresholds.find((threshold) => percent <= threshold.upTo)?.tone ?? 'danger';
}

export default function ProgressBar({
  value,
  max = 100,
  tone,
  thresholds = DEFAULT_THRESHOLDS,
  label,
  className,
  ...props
}) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max === 0 ? 0 : (clamped / max) * 100;
  const resolvedTone = tone ?? toneForPercent(percent, thresholds);
  const fill = TONE_FILL[resolvedTone] ?? TONE_FILL.neutral;

  return (
    <div className={className} {...props}>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-[13px] font-medium text-muted">
          <span>{label}</span>
          <span>{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={['h-full rounded-full transition-[width]', fill].filter(Boolean).join(' ')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
