import Button from '../ui/Button';

const CHANNEL_NAMES = { PUSH: 'push', SMS: 'SMS', AUDIBLE: 'audible' };

const formatCount = (count) => count.toLocaleString('en-US');

// UC01 E3.3 (§5.2): the partial-delivery block under the per-channel counts,
// "3,050 failed alerts resent via SMS (fallback)" and "240 citizens not
// reached [View list]". `fallback` and `unreachedCount` are the delivery
// summary's (§12.7). Shows nothing when every delivery got through first time.
export default function PartialDeliveryPanel({ fallback, unreachedCount, onViewList, className }) {
  if (fallback.resent === 0 && unreachedCount === 0) return null;

  const via = CHANNEL_NAMES[fallback.channel] ?? fallback.channel;

  return (
    <div
      role="status"
      className={['flex flex-col gap-2 rounded-lg bg-warning-soft px-3.5 py-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      {fallback.resent > 0 ? (
        <p className="text-[13px] leading-[18px] font-medium text-warning-ink">
          <span className="tabular-nums">{formatCount(fallback.resent)}</span> failed{' '}
          {fallback.resent === 1 ? 'alert' : 'alerts'} resent via {via} (fallback)
        </p>
      ) : null}
      {unreachedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex-1 text-[13px] leading-[18px] font-semibold text-danger-ink">
            <span className="tabular-nums">{formatCount(unreachedCount)}</span>{' '}
            {unreachedCount === 1 ? 'citizen' : 'citizens'} not reached
          </p>
          <Button variant="small" fullWidth={false} onClick={onViewList}>
            View list
          </Button>
        </div>
      ) : (
        <p className="text-[13px] leading-[18px] font-medium text-warning-ink">
          Every citizen was reached on at least one channel.
        </p>
      )}
    </div>
  );
}
