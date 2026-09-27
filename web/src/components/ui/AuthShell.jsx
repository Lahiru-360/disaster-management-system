/**
 * Presentational layout for the auth pages.
 *
 * `header` is rendered in the navy panel: beside the form on wide screens,
 * above it on narrow ones. The children are the form column.
 */
export default function AuthShell({ header, children, className }) {
  return (
    <div
      className={['flex min-h-screen flex-col bg-paper lg:flex-row', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="bg-navy px-8 py-10 lg:flex lg:w-[44%] lg:flex-col lg:justify-center lg:px-16">
        {header}
      </div>

      <div className="flex flex-1 justify-center px-6 py-10 lg:items-center lg:px-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
