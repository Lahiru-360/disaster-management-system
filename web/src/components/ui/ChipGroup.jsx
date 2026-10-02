// `options`: [{ value, label }]. In single mode `value`/`onChange` carry one
// option value (or null); in multi mode they carry an array.
export default function ChipGroup({ options, value, onChange, multiple = false, className, ...props }) {
  const selected = multiple ? (value ?? []) : value;

  const isSelected = (optionValue) =>
    multiple ? selected.includes(optionValue) : selected === optionValue;

  const toggle = (optionValue) => {
    if (!multiple) {
      onChange(isSelected(optionValue) ? null : optionValue);
      return;
    }

    onChange(
      isSelected(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue],
    );
  };

  return (
    <div
      role="group"
      className={['flex flex-wrap gap-2', className].filter(Boolean).join(' ')}
      {...props}
    >
      {options.map((option) => {
        const active = isSelected(option.value);

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            className={[
              'h-8 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
              'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
              active
                ? 'border-navy bg-navy text-paper'
                : 'border-line bg-paper text-ink hover:bg-haze',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
