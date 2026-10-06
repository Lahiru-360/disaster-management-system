import StatusBadge from '../ui/StatusBadge';

// Each SeverityLevel's tone, SEVERE in the danger tone as in the hi-fi.
const TONES = { SEVERE: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };

// A warning's severity as a badge, for the active warnings list (A3.1).
export default function SeverityBadge({ severity, className }) {
  return (
    <StatusBadge tone={TONES[severity] ?? 'neutral'} className={className}>
      {severity}
    </StatusBadge>
  );
}
