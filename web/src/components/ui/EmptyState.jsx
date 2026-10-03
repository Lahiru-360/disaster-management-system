// A centered placeholder for a list or table with nothing in it: an icon
// glyph, a title, an optional description, and an optional action (e.g. a
// Button to clear a filter or create the first record).
export default function EmptyState({ icon, title, description, action, className, ...props }) {
  return (
    <div
      className={['flex flex-col items-center gap-2 px-6 py-12 text-center', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-haze text-2xl text-muted"
        >
          {icon}
        </span>
      ) : null}
      {title ? <p className="text-[15px] font-semibold text-ink">{title}</p> : null}
      {description ? <p className="max-w-xs text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
