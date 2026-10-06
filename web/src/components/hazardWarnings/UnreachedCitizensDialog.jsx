import Button from '../ui/Button';
import DataTable from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import Loader from '../ui/Loader';
import Modal from '../ui/Modal';
import Notice from '../ui/Notice';

const COLUMNS = [
  { key: 'name', header: 'Name' },
  { key: 'district', header: 'District', render: (row) => row.district?.name ?? '–' },
  { key: 'phone', header: 'Phone', render: (row) => row.phone ?? '–' },
];

// UC01 E3.3, "[View list]" (§5.2): the citizens no channel reached, a page at
// a time, so the officer can follow up. `result` is the last page loaded
// ({ citizens, page, limit, total }, §12.16), or null while the first loads;
// the screen loads pages and passes `loading` and `error`.
export default function UnreachedCitizensDialog({
  open,
  referenceNo,
  result,
  loading = false,
  error = null,
  onPage,
  onClose,
}) {
  const lastPage = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <Modal open={open} onClose={onClose} labelledBy="unreached-title" className="max-w-2xl!">
      <h2 id="unreached-title" className="text-[17px] font-semibold text-ink">
        Citizens not reached – Alert {referenceNo}
      </h2>
      {result ? (
        <p className="mt-1 text-[13px] text-muted">
          <span className="tabular-nums">{result.total.toLocaleString('en-US')}</span>{' '}
          {result.total === 1 ? 'citizen' : 'citizens'} for whom no channel delivered the alert.
        </p>
      ) : null}

      {error ? (
        <Notice variant="error" className="mt-4">
          {error}
        </Notice>
      ) : null}

      <div className="mt-4">
        {loading && !result ? (
          <Loader />
        ) : result ? (
          <DataTable
            aria-label={`Citizens not reached by alert ${referenceNo}`}
            aria-busy={loading || undefined}
            columns={COLUMNS}
            rows={result.citizens}
            emptyState={<EmptyState title="Every citizen was reached" />}
          />
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {result && result.total > result.limit ? (
          <>
            <Button
              variant="small"
              fullWidth={false}
              disabled={loading || result.page <= 1}
              onClick={() => onPage(result.page - 1)}
            >
              Previous
            </Button>
            <span className="text-[13px] text-muted tabular-nums">
              Page {result.page} of {lastPage}
            </span>
            <Button
              variant="small"
              fullWidth={false}
              disabled={loading || result.page >= lastPage}
              onClick={() => onPage(result.page + 1)}
            >
              Next
            </Button>
          </>
        ) : null}
        <Button fullWidth={false} className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
