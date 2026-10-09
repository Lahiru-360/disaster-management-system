import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { groundReportsApi } from '../../api';
import ReportDetailPanel from '../../components/groundReports/ReportDetailPanel';
import ReportQueue from '../../components/groundReports/ReportQueue';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

// What to show after a confirm or dismiss fails. A colleague reviewing the
// report first (UC02 E3, 409 REPORT_ALREADY_REVIEWED) isn't an error on this
// officer's part: it is shown as information - "Already reviewed – current
// status: CONFIRMED" - above the reloaded report, which then says who
// reviewed it and when.
function reviewFailure(error, fallback) {
  const alreadyReviewed = error?.response?.data?.error?.code === 'REPORT_ALREADY_REVIEWED';
  return { message: errorMessage(error, fallback), variant: alreadyReviewed ? 'info' : 'error' };
}

// UC02 steps 10-15 for the duty officer (§5.2): the pending queue for their
// shift district on the left, the selected report on the right. Confirming
// refreshes the queue and keeps the report open, now showing who confirmed it
// and when, plus the actions slot UC01 fills in. `?reportId=` opens that
// report first, e.g. from UC01's "Pre-filled from confirmed report" banner.
export default function GroundReportsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('reportId');
  const isDutyOfficer = user?.role === ROLES.DUTY_OFFICER;

  const [clusters, setClusters] = useState(null);
  const [queueError, setQueueError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
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

  // Step 10: the queue, with the requested report or else its first one open.
  useEffect(() => {
    if (!isDutyOfficer) return;
    loadQueue().then((loaded) => {
      const openId = requestedId ?? loaded?.[0]?.reports[0]?.id;
      if (openId) {
        setSelectedId(openId);
        loadDetail(openId);
      }
    });
  }, [isDutyOfficer, requestedId, loadQueue, loadDetail]);

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
      setActionError(reviewFailure(error, 'The report could not be confirmed. Try again.'));
    } finally {
      setConfirming(false);
    }
    await Promise.all([loadQueue(), loadDetail(selectedId)]);
  }

  // A1: dismiss with a reason and an optional note, then refresh both panels.
  async function dismissSelected({ reason, note }) {
    setDismissing(true);
    setActionError(null);
    try {
      await groundReportsApi.dismiss(selectedId, { reason, note });
    } catch (error) {
      setActionError(reviewFailure(error, 'The report could not be dismissed. Try again.'));
    } finally {
      setDismissing(false);
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
              <Notice variant={actionError.variant} className="mb-4">
                {actionError.message}
              </Notice>
            ) : null}
            {detailError ? (
              <Notice variant="error">{detailError}</Notice>
            ) : detail ? (
              <ReportDetailPanel
                key={detail.report.id}
                report={detail.report}
                cluster={detail.cluster}
                currentUserId={user.id}
                confirming={confirming}
                onConfirm={confirmSelected}
                dismissing={dismissing}
                onDismiss={dismissSelected}
                actions={
                  // UC01 A1.1 (DMS-122): only a CONFIRMED report can be escalated.
                  detail.report.isEscalatable ? (
                    <Button
                      fullWidth={false}
                      onClick={() => navigate(`/hazard-warnings/new?reportId=${detail.report.id}`)}
                    >
                      Escalate to Warning
                    </Button>
                  ) : null
                }
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
