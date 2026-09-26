// A bordered panel. With `onClick` it renders as a button, for a card that
// is itself the thing to click (the login page's demo accounts).
export default function Card({ children, onClick, className, ...props }) {
  const classes = [
    'rounded-xl border border-line bg-paper p-5',
    onClick &&
      'w-full cursor-pointer text-left transition-colors hover:border-navy hover:bg-navy-soft focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} {...props}>
        {children}
      </button>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
