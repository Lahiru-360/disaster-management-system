import { useId } from 'react';

export default function TextArea({
  label,
  error,
  hint,
  maxLength,
  value = '',
  disabled = false,
  rows = 4,
  id,
  className,
  containerClassName,
  ...props
}) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  const counterId = `${textareaId}-counter`;
  const hasError = Boolean(error);
  const length = value.length;
  const describedBy =
    [hasError || hint ? messageId : null, maxLength != null ? counterId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? (
        <label htmlFor={textareaId} className="mb-1.5 block text-[13px] font-semibold text-ink">
          {label}
        </label>
      ) : null}

      <textarea
        id={textareaId}
        rows={rows}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={[
          'w-full resize-y rounded-lg border bg-paper px-3.5 py-2.5 text-[15px] text-ink',
          'placeholder:text-placeholder focus:ring-2 focus:ring-navy-soft focus:outline-none',
          hasError ? 'border-danger' : 'border-line focus:border-navy',
          disabled && 'opacity-40',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

      <div className="mt-1.5 flex items-start justify-between gap-2">
        <div>
          {hasError ? (
            <p id={messageId} className="text-[13px] font-medium text-danger">
              {error}
            </p>
          ) : hint ? (
            <p id={messageId} className="text-[13px] font-medium text-muted">
              {hint}
            </p>
          ) : null}
        </div>
        {maxLength != null ? (
          <p
            id={counterId}
            className={[
              'shrink-0 text-[12px] font-medium tabular-nums',
              length >= maxLength ? 'text-danger' : 'text-muted',
            ].join(' ')}
          >
            {length}/{maxLength}
          </p>
        ) : null}
      </div>
    </div>
  );
}
