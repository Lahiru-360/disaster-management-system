import { joinNames } from '../../utils/joinNames';
import Button from '../ui/Button';
import { HAZARD_TYPES } from './HazardTypePicker';

// UC01 A2.1 (§5.1): "(!) An active Flood warning (HIGH) already covers
// Colombo [Update existing]". `warning` is the preview's activeWarning. With
// `onUpdate` it offers to update that warning instead of sending a duplicate;
// without it (while updating another warning) it only explains the refusal.
export default function ActiveWarningBanner({ warning, onUpdate, className }) {
  const hazardLabel =
    HAZARD_TYPES.find(({ value }) => value === warning.hazardType)?.label ?? warning.hazardType;
  const areas = joinNames(warning.targets.map(({ name }) => name));

  return (
    <div
      role="status"
      className={[
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-warning-soft px-3.5 py-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-warning text-[11px] font-bold text-paper"
      >
        !
      </span>
      <p className="flex-1 text-[13px] leading-[18px] font-medium text-warning-ink">
        An active {hazardLabel} warning ({warning.severity}) already covers {areas}
        {onUpdate ? null : ` – ${warning.referenceNo}. Choose a scope it doesn't cover.`}
      </p>
      {onUpdate ? (
        <Button variant="outline" fullWidth={false} onClick={onUpdate}>
          Update existing
        </Button>
      ) : null}
    </div>
  );
}
