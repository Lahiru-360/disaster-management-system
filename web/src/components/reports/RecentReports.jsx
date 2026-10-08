import { formatDayRange, formatMoment } from '../../utils/reportFormat';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import Notice from '../ui/Notice';
import StatusBadge from '../ui/StatusBadge';

// True when the report was refined (A1): any filter is set.
const isFiltered = (filters) => Object.values(filters ?? {}).some((value) => value);

// UC04 A3 (DMS-158.1): the Recent reports of the chosen event on the parameters
// screen (§14.5), newest first, so a report closed without exporting can be
// opened again. `reports` is null while loading; `error` replaces the list when
// it couldn't be read, since generating a new report doesn't depend on it.
// Presentational: the screen loads the list and opens a report.
export default function RecentReports({ reports, error = null, onOpen }) {
  return (
    <section
      aria-labelledby="recent-reports-heading"
      className="flex max-w-2xl flex-col gap-3 rounded-xl border border-line bg-paper p-5"
    >
      <h2 id="recent-reports-heading" className="text-[15px] font-semibold text-ink">
        Recent reports
      </h2>

      {error ? (
        <Notice variant="error">{error}</Notice>
      ) : !reports ? (
        <Loader />
      ) : reports.length === 0 ? (
        <p className="text-[13px] text-muted">No report has been generated for this event yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {reports.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">
                  {formatDayRange(report.dateFrom, report.dateTo)} ·{' '}
                  {report.districts.map((district) => district.name).join(', ')}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <span>
                    Generated {formatMoment(report.generatedAt)}
                    {report.generatedBy ? ` by ${report.generatedBy.name}` : ''}
                  </span>
                  {report.hasGaps ? (
                    <StatusBadge tone="warning">Incomplete data</StatusBadge>
                  ) : null}
                  {isFiltered(report.filters) ? (
                    <StatusBadge tone="info">Filtered</StatusBadge>
                  ) : null}
                </p>
              </div>
              <Button variant="small" fullWidth={false} onClick={() => onOpen(report)}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
