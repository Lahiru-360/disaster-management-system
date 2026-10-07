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

import { formatCount } from '../../utils/reportFormat';
import { supplyTypeLabel } from '../../utils/supplyTypes';
import DataTable from '../ui/DataTable';
import { CHART, seriesColour } from './chartColours';

// UC04 step 9 (§14.2 `resourceDistribution`): grouped bars of what each
// organisation gave out in each district, then the rows by supply type.
// Quantities are summed in their own units, as the report's total is.
const COLUMNS = [
  { key: 'district', header: 'District', render: (row) => row.district?.name ?? '–' },
  { key: 'supplyType', header: 'Supply type', render: (row) => supplyTypeLabel(row.supplyType) },
  { key: 'organisation', header: 'Organisation', render: (row) => row.organisation?.name ?? '–' },
  { key: 'quantity', header: 'Quantity', render: (row) => formatCount(row.quantity) },
];

export default function DistributionChart({ result }) {
  const organisations = [
    ...new Map(
      result.rows.map((row) => [row.organisation?.id, row.organisation]).filter(([id]) => id),
    ).values(),
  ];
  const byDistrict = new Map();
  result.rows.forEach((row) => {
    const district = row.district?.name ?? '–';
    const totals = byDistrict.get(district) ?? { district };
    const id = row.organisation?.id;
    if (id) totals[id] = (totals[id] ?? 0) + row.quantity;
    byDistrict.set(district, totals);
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="h-72"
        role="img"
        aria-label={`Items distributed by district and organisation, ${formatCount(result.total)} in all`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...byDistrict.values()]}
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          >
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="district" stroke={CHART.axis} fontSize={12} />
            <YAxis tickFormatter={formatCount} stroke={CHART.axis} fontSize={12} width={64} />
            <Tooltip formatter={(value) => formatCount(value)} cursor={{ fill: CHART.cursor }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {organisations.map((organisation, index) => (
              <Bar
                key={organisation.id}
                dataKey={organisation.id}
                name={organisation.name}
                fill={seriesColour(index)}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={result.rows}
        rowKey={(row) => `${row.district?.id}-${row.supplyType}-${row.organisation?.id}`}
      />
      <p className="text-right text-[13px] font-semibold text-ink">
        Total {formatCount(result.total)} items
      </p>
    </div>
  );
}
