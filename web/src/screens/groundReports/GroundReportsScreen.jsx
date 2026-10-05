import { useCallback, useEffect, useState } from 'react';

import { groundReportsApi } from '../../api';
import ReportDetailPanel from '../../components/groundReports/ReportDetailPanel';
import ReportQueue from '../../components/groundReports/ReportQueue';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

// UC02 steps 10-15 for the duty officer (§5.2): the pending queue for their
// shift district on the left, the selected report on the right. Confirming
// refreshes the queue and keeps the report open, now showing who confirmed it
// and when, plus the actions slot UC01 fills in.
export default function GroundReportsScreen() {
  const { user } = useAuth();
  const isDutyOfficer = user?.role === ROLES.DUTY_OFFICER;

  const [clusters, setClusters] = useState(null);
  const [queueError, setQueueError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState(null);

  const loadQueue = useCallback(
    () =>
      groundReportsApi.listPending().then(
        (loaded) => {
          setClusters(loaded);
          setQueueError(null);
          return loaded;
        },
        (error) => setQueueError(errorMessage(error, 'The pending reports could not be loaded.')),
      ),
    [],
  );

  const loadDetail = useCallback(
    (id) =>
      groundReportsApi.getReport(id).then(
        (loaded) => {
          setDetail(loaded);
          setDetailError(null);
        },
        (error) => setDetailError(errorMessage(error, 'This report could not be loaded.')),
      ),
    [],
  );

  // Step 10: the queue, with its first report open.
  useEffect(() => {
    if (!isDutyOfficer) return;
    loadQueue().then((loaded) => {
      const first = loaded?.[0]?.reports[0];
      if (first) {
        setSelectedId(first.id);
        loadDetail(first.id);
      }
    });
  }, [isDutyOfficer, loadQueue, loadDetail]);

  // Step 11.
  function select(id) {
    setSelectedId(id);
    setActionError(null);
    loadDetail(id);
  }

  // Steps 12-13: confirm, then refresh both panels.
  async function confirmSelected() {
    setConfirming(true);
    setActionError(null);
    try {
      await groundReportsApi.confirm(selectedId);
    } catch (error) {
      setActionError(errorMessage(error, 'The report could not be confirmed. Try again.'));
    } finally {
      setConfirming(false);
    }
    await Promise.all([loadQueue(), loadDetail(selectedId)]);
  }

  if (!isDutyOfficer) {
    return (
      <Screen>
        <ScreenHeader title="Ground Reports" />
        <Notice className="mt-4">
          Reviewing ground reports needs the duty officer&apos;s verification privilege.
        </Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Ground Reports" />
      {queueError ? (
        <Notice variant="error" className="mt-4">
          {queueError}
        </Notice>
      ) : null}

      {clusters === null && !queueError ? (
        <Loader className="mt-10" />
      ) : clusters?.length === 0 && !detail ? (
        <EmptyState
          icon="✓"
          title="No pending reports"
          description="New ground reports from your district will appear here."
        />
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
          <ReportQueue clusters={clusters ?? []} selectedId={selectedId} onSelect={select} />
          <section className="rounded-xl border border-line bg-paper p-5">
            {actionError ? (
              <Notice variant="error" className="mb-4">
                {actionError}
              </Notice>
            ) : null}
            {detailError ? (
              <Notice variant="error">{detailError}</Notice>
            ) : detail ? (
              <ReportDetailPanel
                report={detail.report}
                cluster={detail.cluster}
                currentUserId={user.id}
                confirming={confirming}
                onConfirm={confirmSelected}
              />
            ) : (
              <Loader />
            )}
          </section>
        </div>
      )}
    </Screen>
  );
}
