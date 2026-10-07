import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHANNEL_LABELS, CHANNELS } from '../../constants/reports';
import { formatCount, formatPercent } from '../../utils/reportFormat';
import { CHANNEL_COLOURS, CHART } from './chartColours';

// UC04 step 7 (§14.2 `citizensReached`): bars per alert, split by channel, of
// the deliveries that arrived, with each channel's delivery rate above.
export default function CitizensReachedChart({ result }) {
  const data = result.perAlert.map((row) => ({
    name: row.alert.referenceNo,
    reached: row.citizensReached,
    ...Object.fromEntries(row.perChannel.map((channel) => [channel.channel, channel.delivered])),
  }));

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {result.perChannel.map((row) => (
          <li key={row.channel} className="rounded-lg bg-haze px-3 py-2 text-[13px]">
            <span className="font-bold text-ink">{CHANNEL_LABELS[row.channel] ?? row.channel}</span>{' '}
            <span className="text-ink">{formatPercent(row.deliveryRate, 1)} delivered</span>
            <span className="block text-[12px] text-muted">
              {formatCount(row.delivered)} of {formatCount(row.attempted)} ·{' '}
              {formatCount(row.failed)} failed
            </span>
          </li>
        ))}
      </ul>

      <div
        className="h-72"
        role="img"
        aria-label={`Deliveries per alert and channel for ${data.length} alerts`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" stroke={CHART.axis} fontSize={12} />
            <YAxis tickFormatter={formatCount} stroke={CHART.axis} fontSize={12} width={72} />
            <Tooltip formatter={(value) => formatCount(value)} cursor={{ fill: CHART.cursor }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {CHANNELS.map((channel) => (
              <Bar
                key={channel}
                dataKey={channel}
                name={`${CHANNEL_LABELS[channel]} delivered`}
                fill={CHANNEL_COLOURS[channel]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
