import { formatMoment } from '../../utils/reportFormat';
import StatusBadge from '../ui/StatusBadge';

const STATUS_TONES = { SENT: 'success', FAILED: 'danger' };

// UC04 step 15 (DMS-155.5): who the report has been shared with, newest first,
// each with its format, recipient, time and status (§14.10). Presentational:
// the screen loads the shares and passes them in. Renders nothing until the
// report has been shared at least once.
export default function SharesList({ shares }) {
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
          <li
            key={share.shareId}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{share.organisation.name}</p>
              <p className="text-[13px] text-muted">
                {share.recipientEmail} · {share.format} · {formatMoment(share.sharedAt)}
              </p>
            </div>
            <StatusBadge tone={STATUS_TONES[share.status] ?? 'neutral'}>{share.status}</StatusBadge>
          </li>
        ))}
      </ul>
    </section>
  );
}
