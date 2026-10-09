import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';

import { hazardReportsApi } from '../../api';
import MyReportRow from '../../components/hazardReports/MyReportRow';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { TABS } from '../../constants/roles';
import { reportSync } from '../../services/reportSync';
import offlineReportQueue from '../../store/offlineReportQueue';

// The reporter's own reports, newest first, with where each review stands
// (GET /api/hazard-reports/mine, contract §9.3). Reloads whenever the tab
// comes into view - a report just sent from the Report tab shows straight
// away - and on pull-to-refresh. Reports still waiting on the phone to be
// sent (A3) are listed first as "Waiting to send", kept up to date as the
// offline queue changes.
// A report still on the phone (A3/E2), in the shape MyReportRow shows: no
// reference until the server gives it one, and a note on why it waits.
function toQueuedRow(item) {
  let note = null;
  if (item.state === 'NEEDS_ATTENTION') {
    note = `${item.lastError ?? 'The server refused it'}. Tap to correct it.`;
  } else if (item.state === 'WAITING' && item.nextAttemptAt) {
    const at = new Date(item.nextAttemptAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    note = `Couldn't send (${item.lastError ?? 'no connection'}). Trying again at ${at}.`;
  }
  return {
    id: `queued-${item.clientReportId}`,
    clientReportId: item.clientReportId,
    queued: true,
    referenceNo: 'Not sent yet',
    hazardType: item.hazardType,
    submittedAt: item.createdAt,
    status: item.state,
    note,
  };
}

export default function MyReportsScreen() {
  const navigation = useNavigation();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queued, setQueued] = useState([]);

  useEffect(() => {
    let current = true;
    offlineReportQueue.list().then((items) => current && setQueued(items));
    const unsubscribe = offlineReportQueue.subscribe(setQueued);
    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  const load = useCallback(
    () =>
      hazardReportsApi.listMine().then(
        (loaded) => {
          setReports(loaded);
          setError(null);
        },
        (failure) =>
          setError(
            failure?.response?.data?.error?.message ??
              'Your reports could not be loaded. Pull down to try again.',
          ),
      ),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function refresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="My reports" className="px-0" />
      {error ? (
        <Notice variant="error" className="mb-3">
          {error}
        </Notice>
      ) : null}
      {reports === null && !error && queued.length === 0 ? (
        <Loader />
      ) : (
        <FlatList
          data={[...queued.map(toQueuedRow), ...(reports ?? [])]}
          keyExtractor={(report) => report.id}
          renderItem={({ item }) => (
            <MyReportRow
              report={item}
              onRetry={
                item.queued ? () => reportSync.retryNow(item.clientReportId).then(load) : undefined
              }
              onPress={
                item.status === 'NEEDS_ATTENTION'
                  ? () =>
                      navigation.navigate(TABS.REPORT, {
                        correctClientReportId: item.clientReportId,
                      })
                  : undefined
              }
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerClassName="pb-6 flex-grow"
          ListEmptyComponent={
            <EmptyState message="You haven't sent any reports yet. Use the Report tab when you see a hazard." />
          }
        />
      )}
    </Screen>
  );
}
