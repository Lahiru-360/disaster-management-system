import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';

import { hazardReportsApi, uploadApi } from '../../api';
import DescriptionField from '../../components/hazardReports/DescriptionField';
import HazardTypeChips from '../../components/hazardReports/HazardTypeChips';
import LocationRow from '../../components/hazardReports/LocationRow';
import PhotoCapture from '../../components/hazardReports/PhotoCapture';
import SubmittedState from '../../components/hazardReports/SubmittedState';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import { TABS } from '../../constants/roles';
import useCurrentLocation from '../../hooks/useCurrentLocation';
import { uuidv4 } from '../../utils/uuid';
import { hazardReportErrorsFromServer, validateHazardReport } from '../../utils/validation';

function emptyForm() {
  return { photo: null, description: '', hazardType: null, clientReportId: uuidv4() };
}

// UC02 main flow steps 1-8 on the device (§5.1 wireframe): photo, location,
// description, hazard type, then Submit Report, which uploads the photo and
// sends the report. After a successful submit the screen shows the reference
// until the reporter starts another.
export default function ReportHazardScreen() {
  const navigation = useNavigation();
  const [form, setForm] = useState(emptyForm);
  // Step 3: the device's position (A2: 'unavailable' after the timeout).
  const gps = useCurrentLocation();
  const location = gps.location;
  const locationStatus = gps.status;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);

  // Editing a field clears its error; every other input is kept as typed.
  const update = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  // Step 5: upload the photo (§6, folder hazard-reports), then send the
  // report with its URL. The button stays disabled while this runs, so a
  // double tap can't send it twice; the same clientReportId is kept for a
  // retry after a failure.
  async function submit() {
    // E1 on the device: the same rules the server applies, before sending.
    const errors = validateHazardReport({ ...form, location });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError('Check the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const photoUrl = form.photo
        ? await uploadApi.uploadImage(form.photo, 'hazard-reports')
        : null;
      const report = await hazardReportsApi.submit({
        description: form.description,
        hazardType: form.hazardType,
        location,
        locationSource: 'GPS',
        photoUrl,
        clientReportId: form.clientReportId,
      });
      setSubmitted(report);
    } catch (error) {
      const body = error?.response?.data?.error;
      if (body?.code === 'VALIDATION_ERROR') {
        // E1.2: the server's field errors outline the same fields.
        setFieldErrors(hazardReportErrorsFromServer(body.errors));
        setSubmitError('Check the highlighted fields.');
      } else {
        setSubmitError(
          body?.message ?? 'Your report could not be sent. Check your connection and try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reportAnother() {
    setSubmitted(null);
    setFieldErrors({});
    setForm(emptyForm());
    gps.retry();
  }

  if (submitted) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Report a Hazard" />
        <SubmittedState
          referenceNo={submitted.referenceNo}
          onViewReports={() => navigation.navigate(TABS.MY_REPORTS)}
          onReportAnother={reportAnother}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll keyboardShouldPersistTaps="handled" contentClassName="pb-10">
      <ScreenHeader title="Report a Hazard" className="px-0" />

      <SectionLabel className="mb-2 mt-2">Photo of the hazard</SectionLabel>
      <PhotoCapture
        photo={form.photo}
        onChange={update('photo')}
        error={fieldErrors.photo}
        disabled={submitting}
      />

      <SectionLabel className="mb-2">Location</SectionLabel>
      <LocationRow
        location={location}
        status={locationStatus}
        onRetry={gps.retry}
        error={fieldErrors.location}
      />

      <SectionLabel className="mb-2">Description</SectionLabel>
      <DescriptionField
        value={form.description}
        onChangeText={update('description')}
        error={fieldErrors.description}
        disabled={submitting}
      />

      <SectionLabel className="mb-2">Hazard type</SectionLabel>
      <HazardTypeChips
        value={form.hazardType}
        onChange={update('hazardType')}
        error={fieldErrors.hazardType}
        disabled={submitting}
      />

      {submitError ? (
        <Notice variant="error" className="mb-4">
          {submitError}
        </Notice>
      ) : null}

      <Button loading={submitting} onPress={submit}>
        Submit Report
      </Button>
    </Screen>
  );
}
