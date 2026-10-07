import Button from '../ui/Button';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';

const STATUS_TONES = {
  AVAILABLE: 'success',
  DISPATCHED: 'info',
  ON_SITE: 'info',
  UNAVAILABLE: 'neutral',
};

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  DISPATCHED: 'Dispatched',
  ON_SITE: 'On site',
  UNAVAILABLE: 'Unavailable',
};

// Step 2's Rescue Teams table: name, organisation, base location, status and
// the current task (the open dispatch's priority and location, or none). An
// UNAVAILABLE team (E4: it never answered) has a Mark available button when
// `onMarkAvailable` is given; `busyId` is the team being marked.
const COLUMNS = [
  { key: 'name', header: 'Team' },
  { key: 'organisation', header: 'Organisation', render: (row) => row.organisation.name },
  { key: 'baseLocation', header: 'Base location', render: (row) => row.baseLocation.label },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <StatusBadge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge>
    ),
  },
  {
    key: 'currentTask',
    header: 'Current task',
    render: (row) =>
      row.currentTask ? (
        <span>
          {row.currentTask.priority} · {row.currentTask.incidentLocation.label}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
];

export default function RescueTeamsTable({ teams, onMarkAvailable, busyId = null }) {
  const columns = onMarkAvailable
    ? [
        ...COLUMNS,
        {
          key: 'actions',
          header: <span className="sr-only">Actions</span>,
          render: (row) =>
            row.status === 'UNAVAILABLE' ? (
              <Button
                variant="small"
                fullWidth={false}
                loading={busyId === row.id}
                disabled={busyId !== null}
                onClick={() => onMarkAvailable(row)}
              >
                Mark available
              </Button>
            ) : null,
        },
      ]
    : COLUMNS;

  return (
    <DataTable
      columns={columns}
      rows={teams}
      emptyState={
        <EmptyState
          icon="☰"
          title="No rescue teams yet"
          description="Teams registered in this district will appear here."
        />
      }
    />
  );
}
