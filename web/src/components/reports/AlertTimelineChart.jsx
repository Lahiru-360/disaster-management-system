import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { SEVERITIES } from '../../constants/reports';
import {
  DAY_MS,
  formatDayRange,
  formatMoment,
  sriLankaDay,
  sriLankaDayStart,
} from '../../utils/reportFormat';
import { CHART, SEVERITY_COLOURS } from './chartColours';

// UC04 step 6 (§14.2 `alertTimeline`): one marker per status change, placed by
// time and severity and coloured by severity. The marker's shape says what
// happened: issued, updated or the all-clear. Gap days are shaded.
const STATUSES = [
  { status: 'BROADCAST', label: 'Issued', shape: 'circle', glyph: '●' },
  { status: 'UPDATED', label: 'Updated', shape: 'diamond', glyph: '◆' },
  { status: 'CANCELLED', label: 'All-clear', shape: 'cross', glyph: '✚' },
];

// The key under the chart: what each marker shape and colour means.
const SEVERITY_SWATCHES = {
  LOW: 'bg-severity-low',
  MEDIUM: 'bg-severity-medium',
  HIGH: 'bg-severity-high',
  SEVERE: 'bg-severity-severe',
};

const severityLabel = (severity) => severity.charAt(0) + severity.slice(1).toLowerCase();

function EntryTooltip({ active, payload }) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2 text-[12px] text-ink shadow-sm">
      <p className="font-bold">
        {entry.alert.referenceNo} v{entry.version} ·{' '}
        {STATUSES.find((s) => s.status === entry.status)?.label ?? entry.status}
      </p>
      <p className="text-muted">{formatMoment(entry.at)}</p>
      <p>
        {entry.hazardType} · {severityLabel(entry.severity)}
      </p>
      <p>{entry.areas.map((area) => area.name).join(', ')}</p>
    </div>
  );
}

export default function AlertTimelineChart({ result, gaps, from, to }) {
  const start = sriLankaDayStart(from);
  const end = sriLankaDayStart(to) + DAY_MS;
  const ticks = result.days.map((day) => sriLankaDayStart(day.date));
  const points = result.entries.map((entry) => ({
    ...entry,
    time: Date.parse(entry.at),
    level: SEVERITIES.indexOf(entry.severity) + 1,
  }));

  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-72"
        role="img"
        aria-label={`Alert timeline: ${result.entries.length} status changes from ${result.alerts} alerts`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={CHART.grid} />
            {gaps.map((gap) => (
              <ReferenceArea
                key={gap.from}
                x1={sriLankaDayStart(gap.from)}
                x2={sriLankaDayStart(gap.to) + DAY_MS}
                fill={CHART.gapFill}
                fillOpacity={0.8}
                ifOverflow="hidden"
              />
            ))}
            <XAxis
              type="number"
              dataKey="time"
              domain={[start, end]}
              ticks={ticks}
              tickFormatter={(time) =>
                formatDayRange(sriLankaDay(time), undefined, { year: false })
              }
              stroke={CHART.axis}
              fontSize={12}
            />
            <YAxis
              type="number"
              dataKey="level"
              domain={[0.5, SEVERITIES.length + 0.5]}
              ticks={SEVERITIES.map((_, index) => index + 1)}
              tickFormatter={(level) => severityLabel(SEVERITIES[level - 1] ?? '')}
              stroke={CHART.axis}
              fontSize={12}
              width={64}
            />
            <Tooltip content={<EntryTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            {STATUSES.map(({ status, label, shape }) => (
              <Scatter
                key={status}
                name={label}
                data={points.filter((point) => point.status === status)}
                shape={shape}
                fill={CHART.axis}
                isAnimationActive={false}
              >
                {points
                  .filter((point) => point.status === status)
                  .map((point) => (
                    <Cell
                      key={`${point.alert.id}-${point.version}`}
                      fill={SEVERITY_COLOURS[point.severity] ?? CHART.axis}
                    />
                  ))}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[12px] text-muted">
        {STATUSES.map(({ status, label, glyph }) => (
          <li key={status}>
            <span aria-hidden="true">{glyph}</span> {label}
          </li>
        ))}
        {SEVERITIES.map((severity) => (
          <li key={severity} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${SEVERITY_SWATCHES[severity]}`}
            />
            {severityLabel(severity)}
          </li>
        ))}
      </ul>
    </div>
  );
}
