const VARIANT_STYLES = {
  primary: 'h-11 rounded-lg bg-navy px-5 text-[15px] font-semibold text-paper hover:bg-navy-hi',
  outline:
    'h-11 rounded-lg border border-line bg-paper px-5 text-[15px] font-semibold text-ink hover:bg-haze',
  small:
    'h-9 rounded-md border border-line bg-paper px-3 text-sm font-semibold text-ink hover:bg-haze',
  danger: 'h-11 rounded-lg bg-danger px-5 text-[15px] font-semibold text-paper hover:bg-danger-ink',
  // For a dark background, such as the console's top bar.
  'small-inverse':
    'h-9 rounded-md border border-navy-hi bg-navy px-3 text-sm font-semibold text-paper hover:bg-navy-hi',
};

export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = true,
  onClick,
  className,
  ...props
}) {
  const isDisabled = disabled || loading;
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex cursor-pointer items-center justify-center gap-2 transition-colors',
        'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        styles,
        fullWidth && 'w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
