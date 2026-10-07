import { SHELTER_STATUS_LABELS, SHELTER_STATUS_TONES } from '../../utils/shelterStatus';
import Button from '../ui/Button';
import Notice from '../ui/Notice';
import StatusBadge from '../ui/StatusBadge';

// UC03 A2 (§5.1): what an occupancy update that leaves a shelter at 90% or
// more shows. The flag, e.g. "(!) 92% – Near capacity"; the nearest shelter
// that still has space ("Nearest with space: Minuwangoda NS (76%, 3.2 km)");
// and "Redirect arrivals here", which sends new arrivals there. `result` is
// the server's answer to the update. With no shelter to suggest, every shelter
// in the district is at 90% or more (E2, DMS-148): the dialog says so and that
// the DMC has been alerted, and offers no redirect. Presentational: the
// redirect itself is `onRedirect`.
export default function AlternateShelterPanel({
  shelterName,
  result,
  redirected,
  redirecting = false,
  error,
  onRedirect,
}) {
  const { alternateShelter, dmcAlerted, status, rate } = result;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-ink">
        <strong>{shelterName}</strong> was updated.
      </p>
      <div>
        <StatusBadge tone={SHELTER_STATUS_TONES[status]}>
          (!) {Math.round(rate * 100)}% – {SHELTER_STATUS_LABELS[status]}
        </StatusBadge>
      </div>

      {alternateShelter ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-line px-3.5 py-3">
          <p className="text-[14px] text-ink">
            Nearest with space: <strong>{alternateShelter.name}</strong> (
            {Math.round(alternateShelter.rate * 100)}%, {alternateShelter.distanceKm} km)
          </p>
          {redirected ? (
            <Notice>
              New arrivals at {shelterName} now go to {redirected.to.name}.
            </Notice>
          ) : (
            <div>
              <Button fullWidth={false} loading={redirecting} onClick={onRedirect}>
                Redirect arrivals here
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {!alternateShelter && dmcAlerted ? (
        <Notice>No shelter with space – DMC alerted</Notice>
      ) : null}

      {error ? <Notice variant="error">{error}</Notice> : null}
    </div>
  );
}
