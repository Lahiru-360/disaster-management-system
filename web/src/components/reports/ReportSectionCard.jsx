// One numbered report section on the report view: its title, what the chart
// shows, and the chart itself. `note` says which A1 filters the section isn't
// narrowed by, e.g. "Not affected by organisation filter".
export default function ReportSectionCard({ number, title, description, note, children }) {
  return (
    <section className="rounded-xl border border-line bg-paper p-5">
      <h2 className="text-[16px] font-bold text-ink">
        {number}. {title}
      </h2>
      {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      {note ? <p className="mt-1 text-[12px] font-medium text-muted italic">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
