import { joinNames } from '../../utils/joinNames';
import ConfirmDialog from '../ui/ConfirmDialog';
import Notice from '../ui/Notice';
import { HAZARD_TYPES } from './HazardTypePicker';

// UC01 A3.2 (§12.15): "Issue an all-clear for the SEVERE Flood warning in
// Colombo, Gampaha? All 48,200 original recipients will be notified." Back
// sends nothing. `alert` is a row of the active warnings list, carrying
// originalRecipientCount; `error` is shown if sending failed.
export default function AllClearDialog({ open, alert, sending = false, error, onConfirm, onBack }) {
  const hazardLabel =
    HAZARD_TYPES.find(({ value }) => value === alert?.hazardType)?.label ?? alert?.hazardType;
  const areas = joinNames((alert?.targets ?? []).map(({ name }) => name));
  const count = alert?.originalRecipientCount ?? 0;
  const recipients = `${count.toLocaleString('en-US')} original ${count === 1 ? 'recipient' : 'recipients'}`;

  return (
    <ConfirmDialog
      open={open}
      title="Issue all-clear"
      confirmLabel="Send all-clear"
      backLabel="Back"
      loading={sending}
      dismissable={!sending}
      onConfirm={onConfirm}
      onBack={onBack}
    >
      <p>
        Issue an all-clear for the{' '}
        <strong className="text-ink">
          {alert?.severity} {hazardLabel} warning
        </strong>{' '}
        in {areas}? {count === 1 ? 'The' : 'All'}{' '}
        <strong className="text-ink tabular-nums">{recipients}</strong> will be notified.
      </p>
      {error ? (
        <Notice variant="error" className="mt-3">
          {error}
        </Notice>
      ) : null}
    </ConfirmDialog>
  );
}
