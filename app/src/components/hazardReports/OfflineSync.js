import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hazardReportsApi, uploadApi } from '../../api';
import useAuth from '../../hooks/useAuth';
import { isOnlineState } from '../../hooks/useConnectivity';
import { SyncService } from '../../services/SyncService';
import offlineReportQueue from '../../store/offlineReportQueue';

const NOTICE_MS = 4000;

// Runs SyncService (UC02 A3.2) while someone is signed in: once at sign-in or
// app start, then every time the connection comes back. Signed out it does
// nothing, so queued reports are never sent without the reporter's token. Each
// report that reaches the server shows "Report GR-#### sent" for a moment.
// Renders nothing else.
export default function OfflineSync() {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState(null);
  const { user } = useAuth();
  const signedIn = Boolean(user);

  useEffect(() => {
    if (!signedIn) return undefined;
    let timer;
    const sync = new SyncService({
      queue: offlineReportQueue,
      uploadApi,
      hazardReportsApi,
      onSent: (report) => {
        clearTimeout(timer);
        setNotice(`Report ${report.referenceNo} sent`);
        timer = setTimeout(() => setNotice(null), NOTICE_MS);
      },
    });

    let wasOnline = null;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isOnlineState(state);
      // First answer (app start) or back from offline: send what is waiting.
      if (online && wasOnline !== true) {
        sync.syncAll();
      }
      wasOnline = online;
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [signedIn]);

  if (!notice) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ top: insets.top + 8 }}
      className="absolute left-4 right-4 z-50 rounded-ds-md bg-ink px-4 py-3"
    >
      <Text className="text-center text-[13px] font-semibold text-paper">{notice}</Text>
    </View>
  );
}
