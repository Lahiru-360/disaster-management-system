import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { reportsApi } from '../../api';
import AlertTimelineChart from '../../components/reports/AlertTimelineChart';
import CitizensReachedChart from '../../components/reports/CitizensReachedChart';
import DistributionChart from '../../components/reports/DistributionChart';
import IncompleteDataBanner from '../../components/reports/IncompleteDataBanner';
import ReportFilterBar from '../../components/reports/ReportFilterBar';
import OccupancyChart from '../../components/reports/OccupancyChart';
import ReportSectionCard from '../../components/reports/ReportSectionCard';
import SummaryFigures from '../../components/reports/SummaryFigures';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { FILTER_NAMES, NO_FILTERS, SECTION_FILTERS, sectionTitle } from '../../constants/reports';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { apiErrorMessage } from '../../utils/apiErrors';
import { formatDayRange, formatMoment } from '../../utils/reportFormat';

// Each section's chart (the §5.2 wireframe), in report order.
const SECTION_VIEWS = {
  alertTimeline: {
    description: 'Markers by date and severity',
    render: ({ result, gaps, report }) => (
      <AlertTimelineChart result={result} gaps={gaps} from={report.dateFrom} to={report.dateTo} />
    ),
  },
  citizensReached: {
    description: 'Bars per alert, split by channel',
    render: ({ result }) => <CitizensReachedChart result={result} />,
  },
  occupancyOverTime: {
    description: 'Daily peak, a line per district, gap days shaded',
    render: ({ result, gaps }) => <OccupancyChart result={result} gaps={gaps} />,
  },
  resourceDistribution: {
    description: 'Grouped bars by district and organisation',
    render: ({ result }) => <DistributionChart result={result} />,
  },
};

const hasFilters = (filters) => Object.values(filters ?? {}).some((value) => value !== null);

// "Not affected by organisation filter": the filters set on the report that
// this section isn't narrowed by (§14.9).
function filterNote(key, filters) {
  const ignored = Object.keys(FILTER_NAMES).filter(
    (name) => filters?.[name] && !SECTION_FILTERS[key]?.includes(name),
  );
  if (ignored.length === 0) return null;
  const names = ignored.map((name) => FILTER_NAMES[name]).join(' and ');
  return `Not affected by ${names} filter${ignored.length === 1 ? '' : 's'}`;
}

// UC04 main flow step 11 (DMS-153.9): a generated report - summary figures,
// the incomplete-data banner and the four sections with their charts. Opened
// straight after generating (the report comes with the navigation) or later
// by its URL, when it is read back from the server (§14.4).
//
// A1 (DMS-156): the filter bar refines the report into a new stored one,
// opened at its own URL with `?original=` naming the unfiltered report, so
// clearing every filter reopens that report without compiling anything.
// Filters with no data keep the bar and show an empty state (E2 in the view).
export default function ReportViewScreen() {
  const { reportId } = useParams();
  const [searchParams] = useSearchParams();
  const passed = useLocation().state?.report;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReport = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const fromNavigation = passed?.id === reportId ? passed : null;
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  const [organisations, setOrganisations] = useState(null);
  const [refining, setRefining] = useState(null);
  const [refineFailure, setRefineFailure] = useState(null);

  useEffect(() => {
    if (!canReport) return undefined;
    let cancelled = false;
    // Without the list, the organisation filter offers only "All".
    reportsApi.listOrganisations().then(
      (list) => {
        if (!cancelled) setOrganisations(list);
      },
      () => {
        if (!cancelled) setOrganisations([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [canReport]);

  useEffect(() => {
    if (!canReport || fromNavigation) return undefined;
    let cancelled = false;
    reportsApi.getReport(reportId).then(
      (report) => {
        if (!cancelled) setLoaded(report);
      },
      (loadError) => {
        if (cancelled) return;
        setError(
          loadError?.response?.status === 404
            ? 'This report could not be found.'
            : apiErrorMessage(loadError, 'The report could not be loaded.'),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [canReport, fromNavigation, reportId]);

  const report = fromNavigation ?? (loaded?.id === reportId ? loaded : null);
  const newReport = (
    <Button variant="outline" fullWidth={false} onClick={() => navigate('/reports')}>
      New report
    </Button>
  );

  if (!canReport) {
    return (
      <Screen>
        <ScreenHeader title="Post-Event Report" />
        <Notice variant="error" className="mt-4">
          Post-event reports need the DMC officer role.
        </Notice>
      </Screen>
    );
  }

  if (!report) {
    return (
      <Screen>
        <ScreenHeader title="Post-Event Report" rightSlot={newReport} />
        {error ? (
          <Notice variant="error" className="mt-4">
            {error}
          </Notice>
        ) : (
          <Loader className="mt-6" />
        )}
      </Screen>
    );
  }

  const originalId =
    searchParams.get('original') ?? (hasFilters(report.filters) ? null : report.id);
  const failure = refineFailure?.reportId === report.id ? refineFailure : null;
  const shownFilters =
    refining ?? (failure?.noData ? failure.filters : (report.filters ?? NO_FILTERS));

  const opened = (next, original) => {
    setRefining(null);
    const query = original && original !== next.id ? `?original=${original}` : '';
    navigate(`/reports/${next.id}${query}`, { state: { report: next } });
  };
  const failed = (filters) => (refineError) => {
    setRefining(null);
    setRefineFailure({
      reportId: report.id,
      filters,
      noData: refineError?.response?.data?.error?.code === 'NO_DATA_FOR_SELECTION',
      message: apiErrorMessage(refineError, 'The report could not be filtered. Please try again.'),
    });
  };

  // A1.1-A1.2: recompile with the filters, or reopen the unfiltered report.
  const applyFilters = (filters) => {
    setRefineFailure(null);
    if (!hasFilters(filters)) {
      if (originalId) {
        navigate(`/reports/${originalId}`);
        return;
      }
      // A filtered report opened without its original (e.g. from Recent
      // reports): the same selection is generated again, unfiltered.
      setRefining(filters);
      reportsApi
        .generate({
          eventId: report.event.id,
          from: report.dateFrom,
          to: report.dateTo,
          districtIds: report.districts.map(({ id }) => id),
          sections: report.sections.map(({ key }) => key),
        })
        .then((next) => opened(next, null), failed(filters));
      return;
    }
    setRefining(filters);
    reportsApi
      .refine(originalId ?? report.id, filters)
      .then((next) => opened(next, originalId), failed(filters));
  };

  const districtCount = report.districts.length;
  return (
    <Screen>
      <ScreenHeader
        title={`Post-Event Report – ${report.event.name} – ${districtCount} district${districtCount === 1 ? '' : 's'}`}
        rightSlot={newReport}
      />
      <p className="mt-1 text-[13px] text-muted">
        {formatDayRange(report.dateFrom, report.dateTo)} ·{' '}
        {report.districts.map((district) => district.name).join(', ')} · Generated{' '}
        {formatMoment(report.generatedAt)}
        {report.generatedBy ? ` by ${report.generatedBy.name}` : ''}
      </p>

      <div className="mt-5 flex flex-col gap-5">
        <ReportFilterBar
          value={shownFilters}
          districts={report.districts}
          organisations={organisations}
          busy={refining !== null}
          onChange={applyFilters}
        />
        {refining !== null ? <Loader /> : null}
        {failure && !failure.noData ? <Notice variant="error">{failure.message}</Notice> : null}

        {failure?.noData ? (
          <EmptyState
            icon="∅"
            title="No data for this selection"
            description="No records match these filters. Change the filters to see the report again."
            className="rounded-xl border border-line bg-paper"
          />
        ) : (
          <>
            <IncompleteDataBanner gaps={report.gaps} />
            <SummaryFigures report={report} />
            {report.sections.map(({ key, result }, index) => {
              const view = SECTION_VIEWS[key];
              if (!view) return null;
              return (
                <ReportSectionCard
                  key={key}
                  number={index + 1}
                  title={sectionTitle(key)}
                  description={view.description}
                  note={filterNote(key, report.filters)}
                >
                  {view.render({
                    result,
                    report,
                    gaps: report.gaps.filter((gap) => gap.section === key),
                  })}
                </ReportSectionCard>
              );
            })}
          </>
        )}
      </div>
    </Screen>
  );
}
