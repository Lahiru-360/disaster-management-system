const TONE_STYLES = {
  success: { container: 'bg-success-soft', dot: 'bg-success', text: 'text-success-ink' },
  warning: { container: 'bg-warning-soft', dot: 'bg-warning', text: 'text-warning-ink' },
  danger: { container: 'bg-danger-soft', dot: 'bg-danger', text: 'text-danger-ink' },
  info: { container: 'bg-navy-soft', dot: 'bg-navy', text: 'text-navy' },
  neutral: { container: 'bg-haze', dot: 'bg-muted', text: 'text-muted' },
};

export default function StatusBadge({ children, tone = 'neutral', className, ...props }) {
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.neutral;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
        styles.container,
        styles.text,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span
        aria-hidden="true"
        className={['h-1.5 w-1.5 shrink-0 rounded-full', styles.dot].join(' ')}
      />
      {children}
    </span>
  );
}
