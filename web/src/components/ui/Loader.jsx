export default function Loader({ fullScreen = false, className, ...props }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={[
        fullScreen
          ? 'flex min-h-screen items-center justify-center bg-haze'
          : 'flex items-center justify-center py-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-navy border-t-transparent" />
    </div>
  );
}
