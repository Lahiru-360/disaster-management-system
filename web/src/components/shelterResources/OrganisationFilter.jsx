import Select from '../ui/Select';

// Step 14's organisation filter: narrows teams, stock and distributions to
// one owner. "All organisations" (an empty value) is the default and clears
// the filter. Shelters belong to no organisation, so they are never
// narrowed.
export default function OrganisationFilter({ organisations, value, onChange }) {
  const options = [
    { value: '', label: 'All organisations' },
    ...organisations.map((organisation) => ({ value: organisation.id, label: organisation.name })),
  ];

  return (
    <Select
      aria-label="Filter by organisation"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      options={options}
      containerClassName="mb-0 w-56"
    />
  );
}
