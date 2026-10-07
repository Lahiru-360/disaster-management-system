import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { hazardAlertsApi } from '../../api';
import AllClearDialog from '../../components/hazardWarnings/AllClearDialog';
import { HAZARD_TYPES } from '../../components/hazardWarnings/HazardTypePicker';
import SeverityBadge from '../../components/hazardWarnings/SeverityBadge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Tabs from '../../components/ui/Tabs';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// The list's filters: the warnings in force (A3.1), then the drafts (A4).
const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'drafts', label: 'Drafts' },
];

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

const notChosen = <span className="text-muted">Not chosen yet</span>;

const formatTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const hazardLabel = (hazardType) =>
  HAZARD_TYPES.find(({ value }) => value === hazardType)?.label ?? hazardType;

// The sidebar's Hazard Warnings page: where an officer opens "Issue Hazard
// Warning" (UC01 step 1), sees the warnings in force under Active and ends one
// with an all-clear (A3), and resumes a draft they walked away from under
// Drafts (A4). The delivery summary's Issue All-Clear lands here with
// { allClearId } in the router state, which opens that warning's dialog.
export default function HazardWarningsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const canIssue = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const [filter, setFilter] = useState('active');
  const [drafts, setDrafts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [active, setActive] = useState(null);
  const [activeError, setActiveError] = useState(null);
  const requestedAllClear = useRef(state?.allClearId ?? null);
  const [missingNotice, setMissingNotice] = useState(null);
  const [clearing, setClearing] = useState(null);
  const [sending, setSending] = useState(false);
  const [clearError, setClearError] = useState(null);

  useEffect(() => {
    if (!canIssue) return undefined;
    let current = true;
    hazardAlertsApi.listDrafts().then(
      (result) => current && setDrafts(result.alerts),
      (error) =>
        current && setLoadError(errorMessage(error, 'The drafts could not be loaded. Try again.')),
    );
    return () => {
      current = false;
    };
  }, [canIssue]);

  // The active warnings, reloaded after a refused all-clear.
  const reloadActive = async () => {
    try {
      const result = await hazardAlertsApi.listActive();
      setActive(result.alerts);
      return result.alerts;
    } catch (error) {
      setActiveError(errorMessage(error, 'The active warnings could not be loaded. Try again.'));
      return null;
    }
  };

  useEffect(() => {
    if (!canIssue) return undefined;
    let current = true;
    hazardAlertsApi.listActive().then(
      (result) => {
        if (!current) return;
        setActive(result.alerts);
        // Arriving from a delivery summary's Issue All-Clear: open that
        // warning's dialog, and clear the router state so a reload or Back
        // doesn't open it again.
        const requestedId = requestedAllClear.current;
        if (!requestedId) return;
        requestedAllClear.current = null;
        const row = result.alerts.find(({ id }) => id === requestedId);
        if (row) setClearing(row);
        else setMissingNotice('That warning is no longer active, so it needs no all-clear.');
        navigate('.', { replace: true, state: null });
      },
      (error) =>
        current &&
        setActiveError(errorMessage(error, 'The active warnings could not be loaded. Try again.')),
    );
    return () => {
      current = false;
    };
  }, [canIssue, navigate]);

  const resume = (draft) => navigate(`/hazard-warnings/new?draftId=${draft.id}`);

  const openAllClear = (row) => {
    setMissingNotice(null);
    setClearError(null);
    setClearing(row);
  };

  const closeAllClear = () => {
    if (sending) return;
    setClearing(null);
    setClearError(null);
  };

  // A3.2-A3.3: send, then resume at step 14 with the all-clear's summary.
  // Refused (a colleague ended or changed it first), the list is reloaded.
  const sendAllClear = async () => {
    setSending(true);
    setClearError(null);
    try {
      const result = await hazardAlertsApi.allClear(clearing.id);
      navigate(`/hazard-warnings/${clearing.id}`, { state: result });
    } catch (error) {
      setSending(false);
      setClearError(errorMessage(error, 'The all-clear could not be sent. Try again.'));
      if (error?.response?.status === 409) {
        const reloaded = await reloadActive();
        const still = reloaded?.find(({ id }) => id === clearing.id);
        if (still) setClearing(still);
      }
    }
  };

  const activeColumns = [
    { key: 'referenceNo', header: 'Reference' },
    { key: 'hazardType', header: 'Hazard', render: (row) => hazardLabel(row.hazardType) },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => <SeverityBadge severity={row.severity} />,
    },
    {
      key: 'targets',
      header: 'Areas',
      render: (row) => row.targets.map(({ name }) => name).join(', '),
    },
    { key: 'version', header: 'Version', render: (row) => `v${row.version}` },
    { key: 'issuedAt', header: 'Issued at', render: (row) => formatTime(row.issuedAt) },
    { key: 'issuedBy', header: 'Issued by', render: (row) => row.issuedBy?.name ?? '—' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            fullWidth={false}
            onClick={() => navigate(`/hazard-warnings/${row.id}`)}
          >
            View summary
          </Button>
          <Button variant="outline" fullWidth={false} onClick={() => openAllClear(row)}>
            Issue All-Clear
          </Button>
        </div>
      ),
    },
  ];

  const columns = [
    { key: 'referenceNo', header: 'Reference' },
    {
      key: 'hazardType',
      header: 'Hazard',
      render: (row) => (row.hazardType ? hazardLabel(row.hazardType) : notChosen),
    },
    { key: 'severity', header: 'Severity', render: (row) => row.severity ?? notChosen },
    {
      key: 'targets',
      header: 'Areas',
      render: (row) =>
        row.targets.length > 0 ? row.targets.map(({ name }) => name).join(', ') : notChosen,
    },
    { key: 'createdBy', header: 'Started by', render: (row) => row.createdBy?.name ?? '—' },
    { key: 'updatedAt', header: 'Last changed', render: (row) => formatTime(row.updatedAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (row) => (
        <Button variant="outline" fullWidth={false} onClick={() => resume(row)}>
          Resume
        </Button>
      ),
    },
  ];

  let draftsPanel;
  if (loadError) {
    draftsPanel = <Notice variant="error">{loadError}</Notice>;
  } else if (!drafts) {
    draftsPanel = <Loader className="my-6" />;
  } else {
    draftsPanel = (
      <DataTable
        columns={columns}
        rows={drafts}
        emptyState={
          <EmptyState
            icon="!"
            title="No drafts"
            description="A warning you start but don't broadcast or discard is kept here."
          />
        }
      />
    );
  }

  let activePanel;
  if (activeError) {
    activePanel = <Notice variant="error">{activeError}</Notice>;
  } else if (!active) {
    activePanel = <Loader className="my-6" />;
  } else {
    activePanel = (
      <>
        {missingNotice ? <Notice className="mb-4">{missingNotice}</Notice> : null}
        <DataTable
          aria-label="Active hazard warnings"
          columns={activeColumns}
          rows={active}
          emptyState={
            <EmptyState
              icon="!"
              title="No active warnings"
              description="A warning you broadcast stays here until you issue its all-clear."
            />
          }
        />
      </>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Hazard Warnings"
        rightSlot={
          canIssue ? (
            <Button fullWidth={false} onClick={() => navigate('/hazard-warnings/new')}>
              Issue Hazard Warning
            </Button>
          ) : null
        }
      />
      {canIssue ? (
        <Card className="mt-6">
          <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
          <div role="tabpanel" id={`tabpanel-${filter}`} aria-labelledby={`tab-${filter}`}>
            <div className="mt-4">{filter === 'active' ? activePanel : draftsPanel}</div>
          </div>
          <AllClearDialog
            open={clearing !== null}
            alert={clearing}
            sending={sending}
            error={clearError}
            onConfirm={sendAllClear}
            onBack={closeAllClear}
          />
        </Card>
      ) : (
        <Card className="mt-6">
          <EmptyState
            icon="!"
            title="No warning open"
            description="Hazard warnings are issued by DMC and duty officers."
          />
        </Card>
      )}
    </Screen>
  );
}
