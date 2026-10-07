import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCount, formatDayRange } from '../../utils/reportFormat';
import { CHART, seriesColour } from './chartColours';

// UC04 step 8 (§14.2 `occupancyOverTime`): a line per district of its daily
// peak. A day with no records breaks the line instead of dropping to 0, and
// the gap days are shaded.
export default function OccupancyChart({ result, gaps }) {
  const days = result.districts[0]?.days.map((day) => day.date) ?? [];
  const data = days.map((date, index) => ({
    index,
    ...Object.fromEntries(result.districts.map((row) => [row.district.id, row.days[index].peak])),
  }));
  const indexOf = (date) => days.indexOf(date);
  const dayLabel = (index) =>
    days[index] ? formatDayRange(days[index], undefined, { year: false }) : '';

  return (
    <div
      className="h-72"
      role="img"
      aria-label={`Daily peak shelter occupancy for ${result.districts.map((row) => row.district.name).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={CHART.grid} />
          {gaps.map((gap) => (
            <ReferenceArea
              key={gap.from}
              x1={indexOf(gap.from) - 0.5}
              x2={indexOf(gap.to) + 0.5}
              fill={CHART.gapFill}
              fillOpacity={0.8}
              ifOverflow="hidden"
            />
          ))}
          <XAxis
            type="number"
            dataKey="index"
            domain={[-0.5, days.length - 0.5]}
            ticks={days.map((_, index) => index)}
            tickFormatter={dayLabel}
            stroke={CHART.axis}
            fontSize={12}
          />
          <YAxis tickFormatter={formatCount} stroke={CHART.axis} fontSize={12} width={64} />
          <Tooltip
            labelFormatter={dayLabel}
            formatter={(value) => (value === null ? 'no data' : formatCount(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {result.districts.map((row, index) => (
            <Line
              key={row.district.id}
              dataKey={row.district.id}
              name={row.district.name}
              stroke={seriesColour(index)}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
