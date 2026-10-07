import { useId } from 'react';

export const MESSAGE_MAX_LENGTH = 160;

// UC01 step 8: the generated message, editable, with a live "96/160
// characters (one SMS)" counter. Typing past 160 is blocked; `onBlur` is
// where the screen saves the edit to the draft.
export default function BroadcastPreview({ value, onChange, onBlur, error, disabled = false }) {
  const id = useId();
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Broadcast message
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
        onBlur={onBlur}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[counterId, error ? errorId : null].filter(Boolean).join(' ')}
        className={[
          'w-full resize-none rounded-lg border bg-paper px-3.5 py-2.5 text-[15px] text-ink',
          'focus:ring-2 focus:ring-navy-soft focus:outline-none disabled:opacity-40',
          error ? 'border-danger' : 'border-line focus:border-navy',
        ].join(' ')}
      />
      <p
        id={counterId}
        className={[
          'mt-1 text-[12px] font-medium tabular-nums',
          value.length >= MESSAGE_MAX_LENGTH ? 'text-danger' : 'text-muted',
        ].join(' ')}
      >
        {value.length}/{MESSAGE_MAX_LENGTH} characters (one SMS)
      </p>
      {error ? (
        <p id={errorId} className="mt-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
