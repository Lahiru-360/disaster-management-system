// "[3 similar]" on a queue row whose cluster holds more than one report
// (UC02 A4.3). Nothing for a report alone in its cluster.
export default function ClusterBadge({ count, className }) {
  if (!count || count < 2) return null;

  return (
    <span
      className={[
        'shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[12px] font-semibold text-danger-ink',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {count} similar
    </span>
  );
}
