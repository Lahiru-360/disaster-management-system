import Notice from '../ui/Notice';

// UC01 step 7: "48,200 citizens in target scope", the count the preview made.
// A count of zero is E2: nobody would receive the warning, so it says so
// instead. `id` lets the Confirm & Broadcast button point at that reason.
export default function RecipientCount({ count, id }) {
  if (count === 0) {
    return (
      <Notice id={id} variant="error">
        No registered citizens are in the selected scope. Change the target scope to broadcast.
      </Notice>
    );
  }

  return (
    <p id={id} className="text-[15px] text-ink">
      <span className="text-[20px] font-bold tabular-nums">{count.toLocaleString('en-US')}</span>{' '}
      {count === 1 ? 'citizen' : 'citizens'} in target scope
    </p>
  );
}
