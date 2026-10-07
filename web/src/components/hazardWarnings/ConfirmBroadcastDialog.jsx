import { joinNames } from '../../utils/joinNames';
import ConfirmDialog from '../ui/ConfirmDialog';
import { HAZARD_TYPES } from './HazardTypePicker';

// How the dialog names each channel: "via Push, SMS and Audible alert".
const CHANNEL_NAMES = { PUSH: 'Push', SMS: 'SMS', AUDIBLE: 'Audible alert' };

// UC01 steps 10-11 (§5.2): what is about to be sent, to how many citizens,
// where and how, before an irreversible broadcast. Back sends nothing (A4).
// `alert` is the previewed draft; `channels` the preview's [{ channel }].
// With `isUpdate` (A2.3, §12.14), `alert` carries the new severity and scope
// and the dialog announces an UPDATE of the active warning instead.
export default function ConfirmBroadcastDialog({
  open,
  alert,
  recipientCount,
  channels,
  isUpdate = false,
  sending = false,
  onConfirm,
  onBack,
}) {
  const hazardLabel =
    HAZARD_TYPES.find(({ value }) => value === alert?.hazardType)?.label ?? alert?.hazardType;
  const areas = joinNames((alert?.targets ?? []).map(({ name }) => name));
  const via = joinNames(channels.map(({ channel }) => CHANNEL_NAMES[channel] ?? channel));
  const citizens = `${recipientCount.toLocaleString('en-US')} ${recipientCount === 1 ? 'citizen' : 'citizens'}`;

  return (
    <ConfirmDialog
      open={open}
      title={isUpdate ? 'Confirm update' : 'Confirm broadcast'}
      confirmLabel={isUpdate ? 'Send update' : 'Broadcast now'}
      backLabel="Back"
      loading={sending}
      dismissable={!sending}
      onConfirm={onConfirm}
      onBack={onBack}
    >
      {isUpdate ? (
        <p>
          You are about to send an <strong className="text-ink">UPDATE</strong>: the {hazardLabel}{' '}
          warning {alert?.referenceNo} is now{' '}
          <strong className="text-ink">{alert?.severity}</strong>, to{' '}
          <strong className="text-ink tabular-nums">{citizens}</strong> in {areas} via {via}.
        </p>
      ) : (
        <p>
          You are about to send a{' '}
          <strong className="text-ink">
            {alert?.severity} {hazardLabel} warning
          </strong>{' '}
          to <strong className="text-ink tabular-nums">{citizens}</strong> in {areas} via {via}.
        </p>
      )}
      <p className="mt-3">This cannot be recalled. Use All-Clear to end it.</p>
    </ConfirmDialog>
  );
}
