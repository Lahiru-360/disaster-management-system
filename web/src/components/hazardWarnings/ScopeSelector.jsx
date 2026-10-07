import { X } from 'lucide-react';
import { useState } from 'react';

import Tabs from '../ui/Tabs';
import TextInput from '../ui/TextInput';

const TABS = [
  { key: 'districts', label: 'Districts' },
  { key: 'basins', label: 'River basins' },
];

// UC01 step 5, the Target scope card (§5.1): Districts and River basins tabs,
// each with a search box over its list. `value` is the chosen area ids, kept
// across both tabs and shown as removable chips. `error` is the scope field's
// message (E1), which also outlines the list.
export default function ScopeSelector({ districts, riverBasins, value, onChange, error }) {
  const [tab, setTab] = useState('districts');
  const [search, setSearch] = useState('');

  const areas = [
    ...districts.map((district) => ({ id: district.id, name: district.name, detail: null })),
    ...riverBasins.map((basin) => ({
      id: basin.id,
      name: basin.name,
      detail: basin.districts.map((district) => district.name).join(', '),
    })),
  ];
  const nameOf = new Map(areas.map((area) => [area.id, area.name]));

  const list =
    tab === 'districts' ? areas.slice(0, districts.length) : areas.slice(districts.length);
  const query = search.trim().toLowerCase();
  const shown = query ? list.filter((area) => area.name.toLowerCase().includes(query)) : list;

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div>
      <Tabs
        tabs={TABS}
        value={tab}
        onChange={(key) => {
          setTab(key);
          setSearch('');
        }}
      />
      <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-3">
        <TextInput
          aria-label={tab === 'districts' ? 'Search districts' : 'Search river basins'}
          placeholder={tab === 'districts' ? 'Search district…' : 'Search river basin…'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          containerClassName="mb-3"
        />
        <ul
          aria-invalid={Boolean(error) || undefined}
          className={[
            'max-h-56 overflow-y-auto rounded-lg border',
            error ? 'border-danger' : 'border-line',
          ].join(' ')}
        >
          {shown.map((area) => (
            <li key={area.id} className="border-b border-line last:border-b-0">
              <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-haze">
                <input
                  type="checkbox"
                  checked={value.includes(area.id)}
                  onChange={() => toggle(area.id)}
                  className="mt-0.5 h-4 w-4 accent-navy"
                />
                <span className="text-[14px] text-ink">
                  {area.name}
                  {area.detail ? (
                    <span className="block text-[12px] text-muted">{area.detail}</span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
          {shown.length === 0 ? (
            <li className="px-3 py-3 text-[13px] text-muted">No match for “{search.trim()}”.</li>
          ) : null}
        </ul>
        {error ? <p className="mt-1.5 text-[13px] font-medium text-danger">{error}</p> : null}
      </div>

      {value.length > 0 ? (
        <ul aria-label="Selected areas" className="mt-3 flex flex-wrap gap-2">
          {value.map((id) => (
            <li
              key={id}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-navy pr-1.5 pl-3.5 text-[13px] font-semibold text-paper"
            >
              {nameOf.get(id) ?? id}
              <button
                type="button"
                aria-label={`Remove ${nameOf.get(id) ?? id}`}
                onClick={() => toggle(id)}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-navy-hi focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
