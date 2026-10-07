import { useId } from 'react';

import { REPORT_SECTIONS } from '../../constants/reports';
import { eventDays, formatDayRange } from '../../utils/reportFormat';
import Button from '../ui/Button';
import Select from '../ui/Select';
import TextInput from '../ui/TextInput';

// UC04 steps 2-4 (the §5.1 wireframe): the closed event, its date range, the
// districts and the sections to report on. Presentational: the screen owns
// the values and sends them. `values` is null until an event is chosen.
// `errors` holds the server's E1 message for each field it refused (DMS-159),
// shown on that field.
function CheckboxRow({ legend, options, selected, onChange, disabled, error }) {
  const messageId = useId();
  const toggle = (value) =>
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );

  return (
    <fieldset
      className="mb-4"
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? messageId : undefined}
    >
      <legend className="mb-1.5 text-[13px] font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-[15px] text-ink"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-navy"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={messageId} className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export default function ReportParametersForm({
  events,
  values,
  onSelectEvent,
  onChange,
  onReset,
  onSubmit,
  submitting = false,
  errors = {},
}) {
  const event = events.find((item) => item.id === values?.eventId) ?? null;
  const period = event ? eventDays(event) : null;
  const set = (field) => (value) => onChange({ ...values, [field]: value });

  return (
    // noValidate: min/max only guide the date pickers; the server's E1 checks
    // decide, so every refusal shows the same way, on its field.
    <form
      noValidate
      className="max-w-2xl rounded-xl border border-line bg-paper p-6"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        onSubmit();
      }}
    >
      <Select
        label="Event"
        error={errors.eventId}
        placeholder="Select a closed event"
        value={values?.eventId ?? ''}
        onChange={(changeEvent) => onSelectEvent(changeEvent.target.value)}
        options={events.map((item) => {
          const days = eventDays(item);
          return { value: item.id, label: `${item.name} (${formatDayRange(days.from, days.to)})` };
        })}
      />

      <div className="flex gap-4">
        <TextInput
          label="From"
          error={errors.from}
          type="date"
          containerClassName="flex-1"
          value={values?.from ?? ''}
          min={period?.from}
          max={period?.to}
          disabled={!event}
          onChange={(changeEvent) => set('from')(changeEvent.target.value)}
        />
        <TextInput
          label="To"
          error={errors.to}
          type="date"
          containerClassName="flex-1"
          value={values?.to ?? ''}
          min={period?.from}
          max={period?.to}
          disabled={!event}
          onChange={(changeEvent) => set('to')(changeEvent.target.value)}
        />
      </div>

      <CheckboxRow
        legend="Districts"
        error={errors.districtIds}
        disabled={!event}
        options={(event?.districts ?? []).map((district) => ({
          value: district.id,
          label: district.name,
        }))}
        selected={values?.districtIds ?? []}
        onChange={set('districtIds')}
      />

      <CheckboxRow
        legend="Sections"
        error={errors.sections}
        disabled={!event}
        options={REPORT_SECTIONS.map((section) => ({ value: section.key, label: section.title }))}
        selected={values?.sections ?? []}
        onChange={set('sections')}
      />

      <p className="mb-5 text-[13px] text-muted italic">
        Only closed events are listed. Dates must fall inside the event period.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" fullWidth={false} disabled={!event} onClick={onReset}>
          Reset
        </Button>
        <Button type="submit" fullWidth={false} disabled={!event} loading={submitting}>
          Generate report
        </Button>
      </div>
    </form>
  );
}
