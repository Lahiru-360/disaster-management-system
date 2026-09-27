import { useId } from 'react';

export default function TextInput({
  label,
  error,
  hint,
  disabled = false,
  id,
  className,
  containerClassName,
  ...props
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasError = Boolean(error);

  return (
    <div className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-ink">
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError || hint ? messageId : undefined}
        className={[
          'h-11 w-full rounded-lg border bg-paper px-3.5 text-[15px] text-ink',
          'placeholder:text-placeholder focus:ring-2 focus:ring-navy-soft focus:outline-none',
          hasError ? 'border-danger' : 'border-line focus:border-navy',
          disabled && 'opacity-40',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

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
