const VARIANT_STYLES = {
  info: {
    container: 'bg-navy-soft',
    dot: 'bg-navy',
    text: 'text-navy',
  },
  error: {
    container: 'bg-danger-soft',
    dot: 'bg-danger',
    text: 'text-danger-ink',
  },
};

export default function Notice({ children, variant = 'info', icon = '!', className, ...props }) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={['flex items-start gap-2.5 rounded-lg px-3.5 py-3', styles.container, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span
        aria-hidden="true"
        className={[
          'mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper',
          styles.dot,
        ].join(' ')}
      >
        {icon}
      </span>
      <p className={['flex-1 text-[13px] leading-[18px] font-medium', styles.text].join(' ')}>
        {children}
      </p>
    </div>
  );
}
