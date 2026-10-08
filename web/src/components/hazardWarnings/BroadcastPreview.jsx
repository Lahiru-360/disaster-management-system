import { useId } from 'react';

export const MESSAGE_MAX_LENGTH = 160;

// UC01 step 8: the generated message, editable, with a live "96/160
// characters (one SMS)" counter. Typing past 160 is blocked; `onBlur` is
// where the screen saves the edit to the draft. Drawn as the body of the
// phone-notification card, so the box only shows its edge on hover or focus.
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
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
        onBlur={onBlur}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[counterId, error ? errorId : null].filter(Boolean).join(' ')}
        className={[
          'w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-muted',
          'focus:bg-paper focus:text-ink focus:ring-2 focus:ring-navy-soft focus:outline-none disabled:opacity-40',
          error ? 'border-danger' : 'border-transparent hover:border-line focus:border-navy',
        ].join(' ')}
      />
      <p
        id={counterId}
        className={[
          'mt-1 px-2 text-[12px] font-medium tabular-nums',
          value.length >= MESSAGE_MAX_LENGTH ? 'text-danger' : 'text-muted',
        ].join(' ')}
      >
        {value.length}/{MESSAGE_MAX_LENGTH} characters (one SMS)
      </p>
      {error ? (
        <p id={errorId} className="mt-1 px-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
