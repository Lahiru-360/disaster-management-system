import { useId, useState } from 'react';

import { formatCoordinates, formatTime, hazardTypeLabel } from '../../constants/hazardReports';
import Button from '../ui/Button';
import MapView from '../ui/MapView';
import Modal from '../ui/Modal';
import StatusBadge from '../ui/StatusBadge';

const STATUS_TONES = { PENDING: 'warning', CONFIRMED: 'success', DISMISSED: 'neutral' };

// "Citizen #C-1182" - officers never see the reporter's name (contract §9.1),
// only a short handle from their id.
const reporterHandle = (reporter) => `Citizen #C-${String(reporter.id).slice(-4).toUpperCase()}`;

function Field({ label, children }) {
  return (
    <div className="flex gap-2 text-[14px]">
      <dt className="w-28 shrink-0 font-semibold text-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

// UC02 step 11, the §5.2 detail panel: photo, map pin, location and its source,
// time, description, type and the cluster, then Confirm while the report is
// PENDING. `actions` is a slot for other use cases' buttons on a reviewed
// report - UC01 puts "Escalate to Warning" there (DMS-122) - so they never
// have to edit this panel. Presentational: the screen does the calls.
export default function ReportDetailPanel({
  report,
  cluster,
  currentUserId,
  confirming = false,
  onConfirm,
  actions,
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const titleId = useId();
  const { latitude, longitude } = report.location;
  const isPending = report.status === 'PENDING';

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h2 id={titleId} className="flex-1 text-[19px] font-bold text-ink">
          {report.referenceNo} – {hazardTypeLabel(report.hazardType)}
        </h2>
        <StatusBadge tone={STATUS_TONES[report.status]}>{report.status}</StatusBadge>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          className="h-56 cursor-zoom-in overflow-hidden rounded-xl border border-line bg-haze"
          aria-label={`Open the photo for ${report.referenceNo}`}
        >
          <img src={report.photoUrl} alt="" className="h-full w-full object-cover" />
        </button>
        <MapView
          key={report.id}
          label={`Where ${report.referenceNo} was reported`}
          center={{ lat: latitude, lng: longitude }}
          zoom={15}
          markers={[
            {
              id: report.id,
              lat: latitude,
              lng: longitude,
              type: 'report',
              label: report.referenceNo,
            },
          ]}
          className="h-56"
        />
      </div>

      <dl className="flex flex-col gap-1.5">
        <Field label="Location">
          {formatCoordinates(report.location)} ({report.locationSource})
        </Field>
        <Field label="Submitted">
          {formatTime(report.submittedAt)} by {reporterHandle(report.reporter)}
        </Field>
        <Field label="Description">{report.description}</Field>
        <Field label="Hazard type">{hazardTypeLabel(report.hazardType)}</Field>
        <Field label="Cluster">
          {cluster.count > 1
            ? `${cluster.count} reports within 500 m / 2 h (${cluster.others
                .map((other) => other.referenceNo)
                .join(', ')})`
            : 'No similar reports'}
        </Field>
      </dl>

      {isPending ? (
        <div className="flex gap-3">
          <Button fullWidth={false} loading={confirming} onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p className="text-[14px] text-ink">
            {report.status === 'CONFIRMED' ? 'Confirmed' : 'Dismissed'} by{' '}
            {report.reviewedBy?.id === currentUserId ? 'you' : report.reviewedBy?.name} at{' '}
            {formatTime(report.reviewedAt)}
          </p>
          {actions ? <div className="flex gap-3">{actions}</div> : null}
        </div>
      )}

      <Modal open={photoOpen} onClose={() => setPhotoOpen(false)} labelledBy={titleId}>
        <img
          src={report.photoUrl}
          alt={`Photo for ${report.referenceNo}: ${report.description}`}
          className="max-h-[75vh] w-full rounded-lg object-contain"
        />
      </Modal>
    </article>
  );
}
