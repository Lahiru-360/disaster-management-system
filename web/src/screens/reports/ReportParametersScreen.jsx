import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { reportsApi } from '../../api';
import RecentReports from '../../components/reports/RecentReports';
import ReportParametersForm from '../../components/reports/ReportParametersForm';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { SECTION_KEYS } from '../../constants/reports';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { apiErrorMessage, mapFieldErrors } from '../../utils/apiErrors';
import { eventDays } from '../../utils/reportFormat';

// The fields the form can show an E1 error on (DMS-159).
const FORM_FIELDS = ['eventId', 'from', 'to', 'districtIds', 'sections'];

// What the form holds once an event is chosen (step 3): the whole event
// period, every affected district and every section. Reset comes back here.
const defaultsFor = (event) => {
  const { from, to } = eventDays(event);
  return {
    eventId: event.id,
    from,
    to,
    districtIds: event.districts.map((district) => district.id),
    sections: [...SECTION_KEYS],
  };
};

// E2 (DMS-160): every requested section came back empty, so nothing was stored.
const isNoData = (error) => error?.response?.data?.error?.code === 'NO_DATA_FOR_SELECTION';

// UC04 main flow steps 1-5 (DMS-153.9): Reports → Post-Event Analysis. Lists
// the closed events, pre-fills the chosen one's period and districts, and
// generates the report, which then opens in the report view. A3 (DMS-158.1):
// the chosen event's Recent reports are listed under the form, so a report
// closed without exporting can be opened again.
export default function ReportParametersScreen() {
  const { user } = useAuth();
  const canReport = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);
  const navigate = useNavigate();

  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);
  const [values, setValues] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [noData, setNoData] = useState(false);
  // The chosen event's recent reports (§14.5), kept with the event they are for.
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    if (!canReport) return;
    reportsApi
      .listClosedEvents()
      .then(setEvents, (loadError) =>
        setEventsError(apiErrorMessage(loadError, 'Closed events could not be loaded.')),
      );
  }, [canReport]);

  const recentFor = values?.eventId;
  useEffect(() => {
    if (!canReport || !recentFor) return undefined;
    let cancelled = false;
    reportsApi.listRecent(recentFor).then(
      (reports) => {
        if (!cancelled) setRecent({ eventId: recentFor, reports });
      },
      (loadError) => {
        if (cancelled) return;
        setRecent({
          eventId: recentFor,
          error: apiErrorMessage(loadError, 'Recent reports could not be loaded.'),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [canReport, recentFor]);

  const selectEvent = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    setValues(event ? defaultsFor(event) : null);
    setError(null);
    setFieldErrors({});
  };

  // An edited field loses its error; the others keep theirs until resent.
  const change = (next) => {
    const edited = FORM_FIELDS.filter((field) => next[field] !== values?.[field]);
    setFieldErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([field]) => !edited.includes(field))),
    );
    setValues(next);
  };

  const reset = () => selectEvent(values?.eventId);

  const generate = () => {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    reportsApi.generate(values).then(
      (report) => navigate(`/reports/${report.id}`, { state: { report } }),
      (generateError) => {
        if (isNoData(generateError)) {
          setNoData(true);
          setSubmitting(false);
          return;
        }
        // E1 (step 5): the refused fields are highlighted and every input is
        // kept, so the officer corrects them and resumes at step 4.
        const { byField, others } = mapFieldErrors(generateError, FORM_FIELDS);
        if (Object.keys(byField).length > 0 || others.length > 0) {
          setFieldErrors(byField);
          setError(others.length > 0 ? others.join(' ') : null);
        } else {
          setError(
            apiErrorMessage(generateError, 'The report could not be generated. Please try again.'),
          );
        }
        setSubmitting(false);
      },
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Reports › Post-Event Analysis" />

      {!canReport ? (
        <Notice variant="error" className="mt-4">
          Post-event reports need the DMC officer role.
        </Notice>
      ) : eventsError ? (
        <Notice variant="error" className="mt-4">
          {eventsError}
        </Notice>
      ) : !events ? (
        <Loader className="mt-6" />
      ) : events.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon="▤"
          title="No closed events yet"
          description="A report can be generated once a hazard event has been closed."
        />
      ) : noData ? (
        // E2.2: the officer is told plainly and goes back to event selection
        // (step 3), with the selection they tried still filled in.
        <EmptyState
          className="mt-6"
          icon="∅"
          title="No data for this selection"
          description="Nothing was recorded for the chosen sections on these days in these districts. Try a wider range, more districts or other sections."
          action={
            <Button fullWidth={false} onClick={() => setNoData(false)}>
              Back to event selection
            </Button>
          }
        />
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {error ? (
            <Notice variant="error" className="max-w-2xl">
              {error}
            </Notice>
          ) : null}
          <ReportParametersForm
            events={events}
            values={values}
            onSelectEvent={selectEvent}
            onChange={change}
            errors={fieldErrors}
            onReset={reset}
            onSubmit={generate}
            submitting={submitting}
          />
          {values?.eventId ? (
            <RecentReports
              reports={recent?.eventId === values.eventId ? (recent.reports ?? null) : null}
              error={recent?.eventId === values.eventId ? (recent.error ?? null) : null}
              onOpen={(report) => navigate(`/reports/${report.id}`)}
            />
          ) : null}
        </div>
      )}
    </Screen>
  );
}
