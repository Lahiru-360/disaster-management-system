// UC01 step 7: "48,200 citizens in target scope", the count the preview made.
export default function RecipientCount({ count }) {
  return (
    <p className="text-[15px] text-ink">
      <span className="text-[20px] font-bold tabular-nums">{count.toLocaleString('en-US')}</span>{' '}
      {count === 1 ? 'citizen' : 'citizens'} in target scope
    </p>
  );
}
