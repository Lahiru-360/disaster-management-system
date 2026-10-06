import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

import NotificationList from './NotificationList';

// The top bar's bell: the unread count as a badge, and a dropdown of the
// newest items. Presentational apart from whether the dropdown is open; the
// items and what a click does come in as props. Closes on Escape or a click
// outside it.
export default function NotificationBell({
  notifications,
  unreadCount,
  loading,
  error,
  onOpenItem,
  onRetry,
}) {
  const [open, setOpen] = useState(false);
  const container = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const handleOpen = (item) => {
    setOpen(false);
    onOpenItem(item);
  };

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-dark hover:bg-navy-hi hover:text-paper"
      >
        <Bell aria-hidden="true" size={20} strokeWidth={2} />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-paper"
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-20 mt-2 max-h-[28rem] w-96 overflow-y-auto rounded-xl border border-line bg-paper shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
          </div>
          <NotificationList
            notifications={notifications}
            loading={loading}
            error={error}
            onOpen={handleOpen}
            onRetry={onRetry}
          />
        </div>
      ) : null}
    </div>
  );
}
