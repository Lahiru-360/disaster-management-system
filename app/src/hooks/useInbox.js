import { useCallback, useEffect, useState } from 'react';

import { notificationsApi } from '../api';

const PAGE_SIZE = 20;

// The signed-in user's inbox for the Inbox tab: loads the first page on open,
// reloads it on pull-to-refresh, and appends the next page on demand. A failed
// refresh keeps what was already shown and reports the error.
export default function useInbox() {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  // Bumped by refresh() to reload the first page.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadFirstPage() {
      try {
        const inbox = await notificationsApi.listMine({ page: 1, limit: PAGE_SIZE });
        if (cancelled) return;
        setNotifications(inbox.notifications);
        setTotal(inbox.total);
        setPage(1);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, []);

  const hasMore = notifications.length < total;

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const inbox = await notificationsApi.listMine({ page: page + 1, limit: PAGE_SIZE });
      setNotifications((items) => {
        const seen = new Set(items.map((item) => item.id));
        return [...items, ...inbox.notifications.filter((item) => !seen.has(item.id))];
      });
      setTotal(inbox.total);
      setPage(inbox.page);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, page]);

  // Shows the item as read straight away; a failure is reported, and the next
  // refresh shows the server's state.
  const markRead = useCallback(async (id) => {
    const readAt = new Date().toISOString();
    setNotifications((items) =>
      items.map((item) => (item.id === id && !item.readAt ? { ...item, readAt } : item)),
    );
    try {
      await notificationsApi.markRead(id);
    } catch (err) {
      setError(err);
    }
  }, []);

  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    markRead,
  };
}
