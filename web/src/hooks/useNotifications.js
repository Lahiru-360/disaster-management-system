import { useCallback, useEffect, useRef, useState } from 'react';

import { notificationsApi } from '../api';

// How often the bell asks for new items (DMS-106.5).
export const POLL_INTERVAL_MS = 30 * 1000;
const PAGE_SIZE = 10;

// The signed-in user's inbox for the console's bell: the newest items and the
// unread count, refreshed every 30 seconds while the console is open. A failed
// poll keeps what was already shown and reports the error, so one dropped
// request doesn't empty the dropdown.
export default function useNotifications({ intervalMs = POLL_INTERVAL_MS } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Bumped by refresh() to poll again now, e.g. after an error.
  const [reloadKey, setReloadKey] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;

    async function poll() {
      try {
        const inbox = await notificationsApi.listMine({ page: 1, limit: PAGE_SIZE });
        if (cancelled) return;
        setNotifications(inbox.notifications);
        setUnreadCount(inbox.unreadCount);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      mounted.current = false;
      clearInterval(timer);
    };
  }, [intervalMs, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // Marks one item read, showing it as read straight away; the next poll
  // corrects the count if the server disagrees.
  const markRead = useCallback(
    async (id) => {
      const item = notifications.find((candidate) => candidate.id === id);
      if (item && !item.readAt) {
        const readAt = new Date().toISOString();
        setNotifications((items) =>
          items.map((candidate) => (candidate.id === id ? { ...candidate, readAt } : candidate)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      try {
        await notificationsApi.markRead(id);
      } catch (err) {
        if (mounted.current) setError(err);
      }
    },
    [notifications],
  );

  return { notifications, unreadCount, loading, error, refresh, markRead };
}
