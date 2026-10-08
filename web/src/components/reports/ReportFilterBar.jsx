import Select from '../ui/Select';
import { ALERT_HAZARD_TYPES } from '../../constants/reports';

// UC04 A1 (the §5.2 wireframe's filter row): All hazards, All districts and
// All organisations. Presentational: `value` holds the filters on screen
// ({ hazardType, districtId, organisationId }, null for "all") and
// `onChange` gets the whole set with one changed. `organisations` is null
// while they load; `busy` holds the bar while a filtered report is compiled.
export default function ReportFilterBar({
  value,
  districts,
  organisations = null,
  busy = false,
  onChange,
}) {
  const change = (key) => (event) => onChange({ ...value, [key]: event.target.value || null });
  const select = (key, label, all, options, disabled = false) => (
    <Select
      aria-label={label}
      value={value[key] ?? ''}
      onChange={change(key)}
      disabled={busy || disabled}
      options={[{ value: '', label: all }, ...options]}
      containerClassName="mb-0 min-w-44 flex-1"
      className="h-10 text-[14px]"
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-4">
      <span className="text-[13px] font-semibold text-ink">Filter:</span>
      {select('hazardType', 'Hazard type', 'All hazards', ALERT_HAZARD_TYPES)}
      {select(
        'districtId',
        'District',
        'All districts',
        districts.map(({ id, name }) => ({ value: id, label: name })),
      )}
      {select(
        'organisationId',
        'Organisation',
        organisations === null ? 'All organisations (loading…)' : 'All organisations',
        (organisations ?? []).map(({ id, name }) => ({ value: id, label: name })),
        organisations === null,
      )}
    </div>
  );
}
