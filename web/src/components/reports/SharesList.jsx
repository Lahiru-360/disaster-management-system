import { formatMoment } from '../../utils/reportFormat';
import Button from '../ui/Button';
import StatusBadge from '../ui/StatusBadge';

const STATUS_TONES = { SENT: 'success', FAILED: 'danger' };

// UC04 step 15 (DMS-155.5): who the report has been shared with, newest first,
// each with its format, recipient, time and status (§14.10). E4 (DMS-162.3): a
// FAILED share says "Sharing failed – Retry" and Retry sends that same share
// again (§14.11); `retrying` is the id of the share being retried, and
// `retryError` the last failed retry ({ shareId, message }). Presentational:
// the screen loads the shares and does the retry. Renders nothing until the
// report has been shared at least once.
export default function SharesList({ shares, onRetry, retrying = null, retryError = null }) {
  if (shares.length === 0) return null;

  return (
    <section
      aria-labelledby="shares-heading"
      className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5"
    >
      <h2 id="shares-heading" className="text-[15px] font-semibold text-ink">
        Shared with
      </h2>
      <ul className="flex flex-col divide-y divide-line">
        {shares.map((share) => (
          <li key={share.shareId} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">{share.organisation.name}</p>
                <p className="text-[13px] text-muted">
                  {share.recipientEmail} · {share.format} · {formatMoment(share.sharedAt)}
                </p>
              </div>
              <StatusBadge tone={STATUS_TONES[share.status] ?? 'neutral'}>
                {share.status}
              </StatusBadge>
            </div>

            {share.status === 'FAILED' ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3.5 py-3"
              >
                <p className="flex-1 text-[13px] text-danger-ink">
                  <span className="font-semibold">Sharing failed – Retry.</span>{' '}
                  {retryError?.shareId === share.shareId
                    ? retryError.message
                    : (share.failureReason ?? '')}
                </p>
                <Button
                  variant="small"
                  fullWidth={false}
                  loading={retrying === share.shareId}
                  disabled={retrying !== null && retrying !== share.shareId}
                  onClick={() => onRetry(share)}
                >
                  Retry
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
