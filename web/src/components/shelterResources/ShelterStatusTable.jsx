import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ProgressBar from '../ui/ProgressBar';
import StatusBadge from '../ui/StatusBadge';

const STATUS_TONES = {
  AVAILABLE: 'success',
  FILLING_UP: 'warning',
  NEAR_CAPACITY: 'warning',
  FULL: 'danger',
};

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  FILLING_UP: 'Filling up',
  NEAR_CAPACITY: 'Near capacity',
  FULL: 'Full',
};

// Step 2's Shelter Status table: name, district, an occupancy bar and %, and
// a status badge. The bar's own thresholds follow the shelter status rule
// (0.75 / 0.90), not ProgressBar's defaults.
const OCCUPANCY_THRESHOLDS = [
  { upTo: 74, tone: 'success' },
  { upTo: 89, tone: 'warning' },
  { upTo: Infinity, tone: 'danger' },
];

const COLUMNS = [
  { key: 'name', header: 'Shelter' },
  { key: 'district', header: 'District', render: (row) => row.district.name },
  {
    key: 'occupancy',
    header: 'Occupancy',
    render: (row) => (
      <div className="w-40">
        <ProgressBar
          value={row.currentOccupancy}
          max={row.capacity}
          thresholds={OCCUPANCY_THRESHOLDS}
        />
        <p className="mt-1 text-[12px] text-muted">
          {row.currentOccupancy} / {row.capacity} ({Math.round(row.rate * 100)}%)
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <StatusBadge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge>
    ),
  },
];

export default function ShelterStatusTable({ shelters }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={shelters}
      emptyState={
        <EmptyState
          icon="⌂"
          title="No shelters yet"
          description="Registered shelters for this district will appear here."
        />
      }
    />
  );
}
