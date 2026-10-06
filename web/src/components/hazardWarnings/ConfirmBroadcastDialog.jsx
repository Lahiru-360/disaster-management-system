import ConfirmDialog from '../ui/ConfirmDialog';
import { HAZARD_TYPES } from './HazardTypePicker';

// How the dialog names each channel: "via Push, SMS and Audible alert".
const CHANNEL_NAMES = { PUSH: 'Push', SMS: 'SMS', AUDIBLE: 'Audible alert' };

// "Colombo", "Colombo and Gampaha", "Colombo, Gampaha and Kalutara".
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// UC01 steps 10-11 (§5.2): what is about to be sent, to how many citizens,
// where and how, before an irreversible broadcast. Back sends nothing (A4).
// `alert` is the previewed draft; `channels` the preview's [{ channel }].
export default function ConfirmBroadcastDialog({
  open,
  alert,
  recipientCount,
  channels,
  sending = false,
  onConfirm,
  onBack,
}) {
  const hazardLabel =
    HAZARD_TYPES.find(({ value }) => value === alert?.hazardType)?.label ?? alert?.hazardType;
  const areas = joinNames((alert?.targets ?? []).map(({ name }) => name));
  const via = joinNames(channels.map(({ channel }) => CHANNEL_NAMES[channel] ?? channel));

  return (
    <ConfirmDialog
      open={open}
      title="Confirm broadcast"
      confirmLabel="Broadcast now"
      backLabel="Back"
      loading={sending}
      dismissable={!sending}
      onConfirm={onConfirm}
      onBack={onBack}
    >
      <p>
        You are about to send a{' '}
        <strong className="text-ink">
          {alert?.severity} {hazardLabel} warning
        </strong>{' '}
        to{' '}
        <strong className="text-ink tabular-nums">{recipientCount.toLocaleString('en-US')}</strong>{' '}
        {recipientCount === 1 ? 'citizen' : 'citizens'} in {areas} via {via}.
      </p>
      <p className="mt-3">This cannot be recalled. Use All-Clear to end it.</p>
    </ConfirmDialog>
  );
}
