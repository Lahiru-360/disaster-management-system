import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Centered dialog rendered into document.body, with a focus trap and Esc /
// backdrop dismissal. Presentational only: it owns no state about *why* it
// is open, only the open/closed mechanics.
export default function Modal({
  open,
  onClose,
  dismissable = true,
  labelledBy,
  describedBy,
  children,
  className,
  ...props
}) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  // Kept in refs (not effect deps) so re-renders with a fresh `onClose`
  // closure don't tear down and re-run the focus trap while still open.
  // Written in an effect, not during render, per react-hooks/refs.
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissableRef.current = dismissable;
  });

  useEffect(() => {
    if (!open) return undefined;

    triggerRef.current = document.activeElement;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (dismissableRef.current) {
          event.stopPropagation();
          onCloseRef.current?.();
        }
        return;
      }

      if (event.key !== 'Tab' || !panel) return;

      const focusableEls = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusableEls.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      triggerRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(event) => {
        if (dismissable && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={[
          'max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-paper p-6 shadow-xl outline-none',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
