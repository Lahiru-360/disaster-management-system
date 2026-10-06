import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { hazardAlertsApi } from '../../api';
import { HAZARD_TYPES } from '../../components/hazardWarnings/HazardTypePicker';
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

// The list's filters. DMS-124 adds the active warnings.
const FILTERS = [{ key: 'drafts', label: 'Drafts' }];

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

const notChosen = <span className="text-muted">Not chosen yet</span>;

const formatTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// The sidebar's Hazard Warnings page: where an officer opens "Issue Hazard
// Warning" (UC01 step 1), and where a draft they walked away from is listed
// under Drafts so it can be resumed (A4).
export default function HazardWarningsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canIssue = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const [filter, setFilter] = useState('drafts');
  const [drafts, setDrafts] = useState(null);
  const [loadError, setLoadError] = useState(null);

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

  const resume = (draft) => navigate(`/hazard-warnings/new?draftId=${draft.id}`);

  const columns = [
    { key: 'referenceNo', header: 'Reference' },
    {
      key: 'hazardType',
      header: 'Hazard',
      render: (row) =>
        row.hazardType
          ? (HAZARD_TYPES.find(({ value }) => value === row.hazardType)?.label ?? row.hazardType)
          : notChosen,
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

  let panel;
  if (loadError) {
    panel = <Notice variant="error">{loadError}</Notice>;
  } else if (!drafts) {
    panel = <Loader className="my-6" />;
  } else {
    panel = (
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
            <div className="mt-4">{panel}</div>
          </div>
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
