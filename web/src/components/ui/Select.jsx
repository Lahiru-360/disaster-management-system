import { useId } from 'react';

export default function Select({
  label,
  error,
  hint,
  options = [],
  placeholder,
  value,
  disabled = false,
  id,
  className,
  containerClassName,
  ...props
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;
  const hasError = Boolean(error);
  const isControlled = value !== undefined;

  return (
    <div className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? (
        <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-semibold text-ink">
          {label}
        </label>
      ) : null}

      <select
        id={selectId}
        disabled={disabled}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : placeholder ? '' : undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError || hint ? messageId : undefined}
        className={[
          'h-11 w-full rounded-lg border bg-paper px-3.5 text-[15px] text-ink',
          'focus:ring-2 focus:ring-navy-soft focus:outline-none',
          hasError ? 'border-danger' : 'border-line focus:border-navy',
          disabled && 'opacity-40',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {hasError ? (
        <p id={messageId} className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-[13px] font-medium text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
