import { sectionTitle } from '../../constants/reports';
import { formatDayRange } from '../../utils/reportFormat';

// UC04 step 10 (§14.2 `gaps`): the banner over a report with days that have
// no records, so partial figures are never read as complete ones. One line per
// run of days, naming the sections it hits, e.g. "(!) 14–15 Jun: incomplete
// data – figures partial, not omitted (Shelter occupancy)".
export default function IncompleteDataBanner({ gaps, className }) {
  if (!gaps?.length) return null;

  const byRange = new Map();
  gaps.forEach((gap) => {
    const range = formatDayRange(gap.from, gap.to, { year: false });
    byRange.set(range, [...(byRange.get(range) ?? []), sectionTitle(gap.section)]);
  });

  return (
    <div
      role="status"
      className={[
        'rounded-lg border border-warning bg-warning-soft px-4 py-3 text-[13px] font-semibold text-warning-ink',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ul className="flex flex-col gap-1">
        {[...byRange.entries()].map(([range, sections]) => (
          <li key={range}>
            (!) {range}: incomplete data – figures partial, not omitted
            <span className="font-medium"> ({sections.join(', ')})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
