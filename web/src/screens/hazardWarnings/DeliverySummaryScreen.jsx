import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { hazardAlertsApi } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

const CHANNEL_LABELS = { PUSH: 'Push', SMS: 'SMS', AUDIBLE: 'Audible' };

// Update and all-clear apply only to an alert that is still active.
const ACTIVE_STATUSES = ['BROADCAST', 'UPDATED'];

const formatCount = (count) => count.toLocaleString('en-US');

const COLUMNS = [
  {
    key: 'channel',
    header: 'Channel',
    render: (row) => CHANNEL_LABELS[row.channel] ?? row.channel,
  },
  { key: 'sent', header: 'Sent', render: (row) => formatCount(row.sent) },
  { key: 'delivered', header: 'Delivered', render: (row) => formatCount(row.delivered) },
  { key: 'failed', header: 'Failed', render: (row) => formatCount(row.failed) },
];

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

// UC01 step 14 (§5.2): sent, delivered and failed per channel for one alert.
// Opened straight after a broadcast, which hands over its { alert, summary }
// in the router state, or at any time from its URL. Update warning (A2) and
// Issue All-Clear (A3) lead on to DMS-123 and DMS-124.
export default function DeliverySummaryScreen() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canIssue = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const handedOver = state?.alert?.id === id ? state : null;
  const [result, setResult] = useState(handedOver);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!canIssue || handedOver) return undefined;
    let current = true;
    hazardAlertsApi.getDeliverySummary(id).then(
      (loaded) => current && setResult(loaded),
      (error) =>
        current &&
        setLoadError(errorMessage(error, 'The delivery summary could not be loaded. Try again.')),
    );
    return () => {
      current = false;
    };
  }, [canIssue, handedOver, id]);

  if (!canIssue) {
    return (
      <Screen>
        <ScreenHeader title="Delivery summary" />
        <Notice className="mt-4">Delivery summaries are for DMC and duty officers.</Notice>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <ScreenHeader title="Delivery summary" />
        <Notice variant="error" className="mt-4">
          {loadError}
        </Notice>
        <div className="mt-6">
          <Button variant="outline" fullWidth={false} onClick={() => navigate('/hazard-warnings')}>
            Back to Hazard Warnings
          </Button>
        </div>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen>
        <ScreenHeader title="Delivery summary" />
        <Loader className="mt-10" />
      </Screen>
    );
  }

  const { alert, summary } = result;
  const active = ACTIVE_STATUSES.includes(alert.status);

  return (
    <Screen>
      <ScreenHeader title={`Delivery summary – Alert ${alert.referenceNo} (${alert.status})`} />

      {alert.status === 'DRAFT' ? (
        <Notice className="mt-4">
          This warning hasn&apos;t been broadcast, so nothing was sent.
        </Notice>
      ) : null}

      <Card className="mt-5">
        <DataTable
          aria-label={`Deliveries per channel for alert ${alert.referenceNo}`}
          columns={COLUMNS}
          rows={summary.perChannel}
          rowKey={(row) => row.channel}
        />
      </Card>

      <Card className="mt-6 flex flex-wrap items-center gap-3">
        {active ? (
          <>
            <Button
              variant="outline"
              fullWidth={false}
              onClick={() => navigate(`/hazard-warnings/${alert.id}/edit`)}
            >
              Update warning
            </Button>
            <Button
              variant="outline"
              fullWidth={false}
              onClick={() => navigate('/hazard-warnings', { state: { allClearId: alert.id } })}
            >
              Issue All-Clear
            </Button>
          </>
        ) : null}
        <Button fullWidth={false} className="ml-auto" onClick={() => navigate('/hazard-warnings')}>
          Done
        </Button>
      </Card>
    </Screen>
  );
}
