import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { reportsApi } from '../../api';
import ReportParametersForm from '../../components/reports/ReportParametersForm';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { SECTION_KEYS } from '../../constants/reports';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { apiErrorMessage } from '../../utils/apiErrors';
import { eventDays } from '../../utils/reportFormat';

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

// UC04 main flow steps 1-5 (DMS-153.9): Reports → Post-Event Analysis. Lists
// the closed events, pre-fills the chosen one's period and districts, and
// generates the report, which then opens in the report view.
export default function ReportParametersScreen() {
  const { user } = useAuth();
  const canReport = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);
  const navigate = useNavigate();

  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);
  const [values, setValues] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canReport) return;
    reportsApi
      .listClosedEvents()
      .then(setEvents, (loadError) =>
        setEventsError(apiErrorMessage(loadError, 'Closed events could not be loaded.')),
      );
  }, [canReport]);

  const selectEvent = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    setValues(event ? defaultsFor(event) : null);
    setError(null);
  };

  const reset = () => selectEvent(values?.eventId);

  const generate = () => {
    setSubmitting(true);
    setError(null);
    reportsApi.generate(values).then(
      (report) => navigate(`/reports/${report.id}`, { state: { report } }),
      (generateError) => {
        setError(
          apiErrorMessage(generateError, 'The report could not be generated. Please try again.'),
        );
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
            onChange={setValues}
            onReset={reset}
            onSubmit={generate}
            submitting={submitting}
          />
        </div>
      )}
    </Screen>
  );
}
