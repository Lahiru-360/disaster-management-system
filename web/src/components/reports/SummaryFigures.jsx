import { formatCount, formatDayRange, formatPercent } from '../../utils/reportFormat';

// UC04 step 11: the report's summary figures (§14.2 `summary`), e.g. "Alerts
// issued 14 · Citizens reached 128,400 (94%) · Peak occupancy 4,120 · Items
// distributed 18,650". Only the requested sections' figures are shown, and a
// figure whose section has gaps says it is partial.
const FIGURES = [
  {
    section: 'alertTimeline',
    label: 'Alerts issued',
    value: (s) => formatCount(s.alertsIssued),
  },
  {
    section: 'citizensReached',
    label: 'Citizens reached',
    value: (s) =>
      s.reachedRate === null
        ? formatCount(s.citizensReached)
        : `${formatCount(s.citizensReached)} (${formatPercent(s.reachedRate)})`,
    detail: (s) => `of ${formatCount(s.citizensTargeted)} targeted`,
  },
  {
    section: 'occupancyOverTime',
    label: 'Peak occupancy',
    value: (s) => formatCount(s.peakOccupancy),
    detail: (s) => (s.peakOccupancyDate ? `on ${formatDayRange(s.peakOccupancyDate)}` : 'no data'),
  },
  {
    section: 'resourceDistribution',
    label: 'Items distributed',
    value: (s) => formatCount(s.itemsDistributed),
  },
];

export default function SummaryFigures({ report, className }) {
  const requested = new Set(report.sections.map((section) => section.key));
  const partial = new Set(report.gaps.map((gap) => gap.section));
  const shown = FIGURES.filter((figure) => requested.has(figure.section));

  return (
    <dl className={['grid grid-cols-2 gap-3 lg:grid-cols-4', className].filter(Boolean).join(' ')}>
      {shown.map((figure) => (
        <div key={figure.label} className="rounded-xl border border-line bg-paper px-4 py-3">
          <dt className="text-[12px] font-semibold tracking-wide text-muted uppercase">
            {figure.label}
          </dt>
          <dd className="mt-1 text-[22px] font-bold text-ink">{figure.value(report.summary)}</dd>
          {figure.detail || partial.has(figure.section) ? (
            <dd className="mt-0.5 text-[12px] text-muted">
              {figure.detail?.(report.summary)}
              {figure.detail && partial.has(figure.section) ? ' · ' : ''}
              {partial.has(figure.section) ? (
                <span className="font-semibold text-warning-ink">partial</span>
              ) : null}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
