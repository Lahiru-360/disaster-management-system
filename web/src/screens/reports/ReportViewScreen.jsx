import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { reportsApi } from '../../api';
import AlertTimelineChart from '../../components/reports/AlertTimelineChart';
import CitizensReachedChart from '../../components/reports/CitizensReachedChart';
import DistributionChart from '../../components/reports/DistributionChart';
import ExportActions from '../../components/reports/ExportActions';
import IncompleteDataBanner from '../../components/reports/IncompleteDataBanner';
import OccupancyChart from '../../components/reports/OccupancyChart';
import ReportSectionCard from '../../components/reports/ReportSectionCard';
import SummaryFigures from '../../components/reports/SummaryFigures';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { sectionTitle } from '../../constants/reports';
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

// The name a downloaded export is saved under (where the browser honours it).
const exportFileName = (report, format) =>
  `post-event-report-${report.event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${report.dateFrom}-to-${report.dateTo}.${format.toLowerCase()}`;

// Opens the exported file as a download, as if its link had been clicked.
function startDownload({ fileUrl, fileName }) {
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// UC04 main flow step 11 (DMS-153.9): a generated report - summary figures,
// the incomplete-data banner and the four sections with their charts. Opened
// straight after generating (the report comes with the navigation) or later
// by its URL, when it is read back from the server (§14.4). Steps 12-13
// (DMS-154.5): Export PDF / Export CSV, then "Export ready – Download".
export default function ReportViewScreen() {
  const { reportId } = useParams();
  const passed = useLocation().state?.report;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReport = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const fromNavigation = passed?.id === reportId ? passed : null;
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState(null);
  // The format being exported, the last export and the last export error, each
  // kept with the report it belongs to.
  const [exporting, setExporting] = useState(null);
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState(null);

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

  const exportAs = (format) => {
    const forReport = report.id;
    setExporting(format);
    setExportError(null);
    reportsApi.exportReport(forReport, format).then(
      (created) => {
        const file = { ...created, reportId: forReport, fileName: exportFileName(report, format) };
        setExported(file);
        setExporting(null);
        startDownload(file);
      },
      (exportFailure) => {
        setExportError({
          reportId: forReport,
          message: apiErrorMessage(
            exportFailure,
            'The export could not be made. Please try again.',
          ),
        });
        setExporting(null);
      },
    );
  };
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
            >
              {view.render({
                result,
                report,
                gaps: report.gaps.filter((gap) => gap.section === key),
              })}
            </ReportSectionCard>
          );
        })}
        <ExportActions
          onExport={exportAs}
          exporting={exporting}
          ready={exported?.reportId === report.id ? exported : null}
        >
          {exportError?.reportId === report.id ? (
            <Notice variant="error">{exportError.message}</Notice>
          ) : null}
        </ExportActions>
      </div>
    </Screen>
  );
}
