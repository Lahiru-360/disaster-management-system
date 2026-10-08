import { CalendarDays } from 'lucide-react';

// UC03 step 1's precondition made visible: a box naming the district's ACTIVE
// incident, or saying there is none. `children`, when given, are rendered
// beside it.
export default function IncidentHeader({ incident, districtName, children }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-2">
        <CalendarDays size={22} className="text-muted" aria-hidden="true" />
        <div>
          <p className="text-[12px] text-muted">Current Incident</p>
          <h2 className="text-[14px] font-semibold text-ink">
            {incident ? incident.name : `No active incident for ${districtName}`}
          </h2>
        </div>
      </div>
      {children ? <div className="flex flex-wrap gap-2.5">{children}</div> : null}
    </div>
  );
}
