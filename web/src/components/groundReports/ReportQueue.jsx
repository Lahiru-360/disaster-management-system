import { hazardTypeShort } from '../../constants/hazardReports';
import ClusterBadge from './ClusterBadge';

// UC02 step 10, the §5.2 left panel: one row per cluster, led by its newest
// report, with a cluster badge when others reported the same thing.
// Presentational: the screen owns the clusters and the selection.
export default function ReportQueue({ clusters, selectedId, onSelect }) {
  const reportCount = clusters.reduce((total, cluster) => total + cluster.count, 0);

  return (
    <nav aria-label="Pending reports">
      <h2 className="mb-3 text-[15px] font-bold text-ink">Pending reports ({clusters.length})</h2>
      <ul className="flex flex-col gap-1.5">
        {clusters.map(({ clusterId, count, reports }) => {
          const lead = reports[0];
          const selected = reports.some((report) => report.id === selectedId);
          return (
            <li key={clusterId}>
              <button
                type="button"
                onClick={() => onSelect(lead.id)}
                aria-current={selected || undefined}
                className={[
                  'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
                  selected ? 'border-navy bg-navy-soft' : 'border-line bg-paper hover:bg-haze',
                ].join(' ')}
              >
                <span className="text-[14px] font-semibold text-ink">{lead.referenceNo}</span>
                <span className="flex-1 truncate text-[14px] text-muted">
                  {hazardTypeShort(lead.hazardType)}
                </span>
                <ClusterBadge count={count} />
              </button>
            </li>
          );
        })}
      </ul>
      {reportCount > clusters.length ? (
        <p className="mt-3 text-[12px] text-muted">
          {reportCount} reports in {clusters.length} situations.
        </p>
      ) : null}
    </nav>
  );
}
