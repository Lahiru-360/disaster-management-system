import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ProgressBar from '../ui/ProgressBar';
import StatusBadge from '../ui/StatusBadge';
import { SHELTER_STATUS_LABELS, SHELTER_STATUS_TONES } from '../../utils/shelterStatus';

// Step 2's Shelter Status table: name, district, an occupancy bar and %, and
// a status badge. The bar's own thresholds follow the shelter status rule
// (0.75 / 0.90), not ProgressBar's defaults.
const OCCUPANCY_THRESHOLDS = [
  { upTo: 74, tone: 'success' },
  { upTo: 89, tone: 'warning' },
  { upTo: Infinity, tone: 'danger' },
];

const COLUMNS = [
  { key: 'name', header: 'Shelter Name' },
  { key: 'district', header: 'District', render: (row) => row.district.name },
  {
    key: 'occupancy',
    header: 'Occupancy',
    render: (row) => (
      <div className="flex items-center gap-3" title={`${row.currentOccupancy} / ${row.capacity}`}>
        <ProgressBar
          value={row.currentOccupancy}
          max={row.capacity}
          thresholds={OCCUPANCY_THRESHOLDS}
          className="w-24"
        />
        <span className="w-10 text-[13px] font-semibold text-ink tabular-nums">
          {Math.round(row.rate * 100)}%
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge tone={SHELTER_STATUS_TONES[row.status]}>
          {SHELTER_STATUS_LABELS[row.status]}
        </StatusBadge>
        {row.redirectingTo ? (
          <span className="text-[12px] text-muted">Redirecting to {row.redirectingTo.name}</span>
        ) : null}
      </div>
    ),
  },
];

// `onSelect(shelter)`, when given, makes each row clickable: step 3 opens the
// Update Shelter Occupancy dialog for the row clicked.
export default function ShelterStatusTable({ shelters, onSelect }) {
  return (
    <DataTable
      dense
      className="max-h-48 overflow-y-auto"
      columns={COLUMNS}
      rows={shelters}
      onRowClick={onSelect}
      emptyState={
        <EmptyState
          className="py-4"
          icon="⌂"
          title="No shelters yet"
          description="Registered shelters for this district will appear here."
        />
      }
    />
  );
}
