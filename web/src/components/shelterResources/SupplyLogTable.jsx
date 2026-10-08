import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';

const formatDateTime = (iso) => new Date(iso).toLocaleString();

// Step 2's Recent Relief Supply Logs: the 10 most recent distributions, each
// with its supply type, quantity, receiving shelter, owner organisation and
// date/time.
const COLUMNS = [
  { key: 'supplyType', header: 'Supply Type' },
  { key: 'quantity', header: 'Quantity', render: (row) => `${row.quantity} ${row.unit}` },
  { key: 'shelter', header: 'Receiving Shelter', render: (row) => row.shelter.name },
  { key: 'organisation', header: 'Owner Organisation', render: (row) => row.organisation.name },
  {
    key: 'distributedAt',
    header: 'Date & Time',
    render: (row) => formatDateTime(row.distributedAt),
  },
];

export default function SupplyLogTable({ distributions }) {
  return (
    <DataTable
      dense
      className="max-h-48 overflow-y-auto"
      columns={COLUMNS}
      rows={distributions}
      emptyState={
        <EmptyState
          className="py-4"
          icon="▦"
          title="No relief supplies logged yet"
          description="Supply distributions for this district will appear here."
        />
      }
    />
  );
}
