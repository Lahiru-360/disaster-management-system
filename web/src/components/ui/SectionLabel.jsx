export default function SectionLabel({ children, className, ...props }) {
  return (
    <p
      className={['text-[11px] font-bold tracking-[0.13em] text-muted uppercase', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </p>
  );
}
