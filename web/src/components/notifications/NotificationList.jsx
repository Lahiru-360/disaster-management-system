import { Bell } from 'lucide-react';

import EmptyState from '../ui/EmptyState';
import Loader from '../ui/Loader';
import Notice from '../ui/Notice';

// How long ago, in words short enough for a dropdown row.
function timeAgo(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

// The inbox items in the bell's dropdown, newest first. Presentational: the
// items, the loading and error state and what to do on a click all come in as
// props. An unread item is marked with a dot and a bold title.
export default function NotificationList({ notifications, loading, error, onOpen, onRetry }) {
  if (loading && notifications.length === 0) {
    return <Loader />;
  }

  return (
    <div>
      {error ? (
        <Notice variant="error" className="m-3">
          Couldn&apos;t load notifications.{' '}
          <button type="button" className="font-semibold underline" onClick={onRetry}>
            Try again
          </button>
        </Notice>
      ) : null}

      {notifications.length === 0 && !error ? (
        <EmptyState
          icon={<Bell size={22} />}
          title="No notifications"
          description="New reports, capacity alerts and support requests will appear here."
        />
      ) : (
        <ul className="divide-y divide-line">
          {notifications.map((item) => {
            const unread = item.readAt === null;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-haze"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      unread ? 'bg-navy' : 'bg-transparent',
                    ].join(' ')}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        'block text-sm text-ink',
                        unread ? 'font-semibold' : 'font-medium',
                      ].join(' ')}
                    >
                      {item.title}
                      {unread ? <span className="sr-only"> (unread)</span> : null}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">{item.body}</span>
                    <span className="mt-1 block text-xs text-placeholder">
                      {timeAgo(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
