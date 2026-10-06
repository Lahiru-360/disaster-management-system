import { hazardReportsApi, uploadApi } from '../api';
import offlineReportQueue from '../store/offlineReportQueue';
import { SyncService } from './SyncService';

// The app's one SyncService (UC02 A3/E2), shared by OfflineSync (which runs
// it) and My reports (Retry now). Screens subscribe to each sent report with
// onReportSent.
const sentListeners = new Set();

export const reportSync = new SyncService({
  queue: offlineReportQueue,
  uploadApi,
  hazardReportsApi,
  onSent: (report) => sentListeners.forEach((listener) => listener(report)),
});

/** Calls `listener(report)` for each report that reaches the server. Returns the unsubscribe function. */
export function onReportSent(listener) {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
}
