export default function ScreenHeader({ title, rightSlot, className }) {
  return (
    <div
      className={['flex min-h-12 items-center justify-between gap-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      <h1 className="flex-1 truncate text-[25px] font-bold tracking-[-0.03em] text-ink">{title}</h1>
      {rightSlot ?? null}
    </div>
  );
}
