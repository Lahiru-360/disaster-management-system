import Button from '../ui/Button';

// UC04 steps 12-13 (the §5.2 wireframe's action row): Export PDF and Export
// CSV, then "Export ready – Download" for the file just made. Presentational:
// the screen exports and passes the state in. `exporting` is the format being
// written, `ready` the last export ({ format, fileUrl, fileName }), and
// `failure` the last failed one ({ format, message, retryable }): E3 (DMS-161)
// shows "Export failed – try again" under the buttons, and Retry sends the
// same request again while the report stays on screen.
const FORMATS = [
  { format: 'PDF', label: 'Export PDF' },
  { format: 'CSV', label: 'Export CSV' },
];

export default function ExportActions({
  onExport,
  exporting = null,
  ready = null,
  failure = null,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5">
      <div className="flex flex-wrap gap-3">
        {FORMATS.map(({ format, label }) => (
          <Button
            key={format}
            variant="outline"
            fullWidth={false}
            loading={exporting === format}
            disabled={exporting !== null && exporting !== format}
            onClick={() => onExport(format)}
          >
            {label}
          </Button>
        ))}
      </div>

      {ready ? (
        <p role="status" className="text-[13px] font-semibold text-success-ink">
          {ready.format} export ready –{' '}
          <a
            href={ready.fileUrl}
            download={ready.fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink"
          >
            Download
          </a>
        </p>
      ) : null}

      {failure ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3.5 py-3"
        >
          <p className="flex-1 text-[13px] text-danger-ink">
            <span className="font-semibold">{failure.format} export failed – try again.</span>{' '}
            {failure.message}
          </p>
          {failure.retryable ? (
            <Button
              variant="small"
              fullWidth={false}
              loading={exporting === failure.format}
              onClick={() => onExport(failure.format)}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
