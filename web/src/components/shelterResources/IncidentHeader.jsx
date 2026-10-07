// UC03 step 1's precondition made visible: the title names the district's
// ACTIVE incident, or says there is none. `children` (the action buttons) are
// rendered either way - the caller disables them itself while there's no
// incident.
export default function IncidentHeader({ incident, districtName, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[13px] font-semibold text-muted uppercase">Current Incident</p>
        {incident ? (
          <h2 className="text-[20px] font-bold text-ink">{incident.name}</h2>
        ) : (
          <h2 className="text-[20px] font-bold text-ink">No active incident for {districtName}</h2>
        )}
      </div>
      {children ? <div className="flex flex-wrap gap-2.5">{children}</div> : null}
    </div>
  );
}
