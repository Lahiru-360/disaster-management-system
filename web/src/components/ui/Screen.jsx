// Padding wrapper for a console page, inside ConsoleLayout's main area.
export default function Screen({ children, className, ...props }) {
  return (
    <div className={['px-8 py-7', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}
