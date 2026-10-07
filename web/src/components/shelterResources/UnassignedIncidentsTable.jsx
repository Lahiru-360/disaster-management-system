import Button from '../ui/Button';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import StatusBadge from '../ui/StatusBadge';
import { PRIORITIES } from '../../utils/dispatchPriority';

const PRIORITY_LABELS = Object.fromEntries(PRIORITIES.map(({ value, label }) => [value, label]));

const PRIORITY_TONES = { LOW: 'neutral', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'danger' };

const formatDateTime = (iso) => new Date(iso).toLocaleString();

// UC03 E3 (DMS-149): the unassigned incidents - the ones no team could take -
// each with its priority, when it was queued, whether the DMC was asked for
// support, and a Dispatch button for the officer to use once a team is free.
// Presentational: `onDispatch(dispatch)` comes in as a callback, and without
// it (the DMC only reads) there is no button.
export default function UnassignedIncidentsTable({ dispatches, onDispatch }) {
  const columns = [
    {
      key: 'incidentLocation',
      header: 'Incident',
      render: (row) => row.incidentLocation.label ?? 'Pinned location',
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => (
        <StatusBadge tone={PRIORITY_TONES[row.priority]}>
          {PRIORITY_LABELS[row.priority] ?? row.priority}
        </StatusBadge>
      ),
    },
    { key: 'createdAt', header: 'Queued', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'supportRequested',
      header: 'DMC support',
      render: (row) =>
        row.supportRequested ? (
          <StatusBadge tone="info">Requested</StatusBadge>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    ...(onDispatch
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            render: (row) => (
              <Button variant="small" fullWidth={false} onClick={() => onDispatch(row)}>
                Dispatch
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      rows={dispatches}
      emptyState={
        <EmptyState
          icon="✓"
          title="No unassigned incidents"
          description="Incidents that no team could take will wait here until one is free."
        />
      }
    />
  );
}
