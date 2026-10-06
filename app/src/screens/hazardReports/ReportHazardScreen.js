import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';

import { hazardReportsApi, uploadApi } from '../../api';
import DescriptionField from '../../components/hazardReports/DescriptionField';
import HazardTypeChips from '../../components/hazardReports/HazardTypeChips';
import LocationRow from '../../components/hazardReports/LocationRow';
import ManualLocationSheet from '../../components/hazardReports/ManualLocationSheet';
import OfflineBanner from '../../components/hazardReports/OfflineBanner';
import PhotoCapture from '../../components/hazardReports/PhotoCapture';
import SubmittedState from '../../components/hazardReports/SubmittedState';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import { TABS } from '../../constants/roles';
import { OfflineQueueFullError } from '../../store/OfflineQueue';
import offlineReportQueue from '../../store/offlineReportQueue';
import useAuth from '../../hooks/useAuth';
import useConnectivity from '../../hooks/useConnectivity';
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
  const route = useRoute();
  const [form, setForm] = useState(emptyForm);
  // E2/E1: a saved report the server refused, opened from My reports to be
  // corrected; its clientReportId is kept so it is still sent only once.
  const [correcting, setCorrecting] = useState(null);
  // Step 3: the device's position (A2: 'unavailable' after the timeout).
  const gps = useCurrentLocation();
  const { isOnline } = useConnectivity();
  // A2: a location set by hand ({ location, placeName }) wins over the GPS.
  const [manual, setManual] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // A2.2 opens the picker by itself when there is no fix - once, so closing it
  // leaves the reporter on the form.
  const [autoSheetShown, setAutoSheetShown] = useState(false);
  const { user } = useAuth();
  const location = manual ? manual.location : gps.location;
  const locationSource = manual ? (manual.source ?? 'MANUAL') : 'GPS';
  const showSheet = sheetOpen || (gps.status === 'unavailable' && !manual && !autoSheetShown);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);

  // Opened with a report to correct: fill the form with it and outline the
  // fields the server refused.
  const correctId = route.params?.correctClientReportId;
  useEffect(() => {
    if (!correctId) return undefined;
    let current = true;
    offlineReportQueue.list().then((items) => {
      const item = items.find((candidate) => candidate.clientReportId === correctId);
      if (!current || !item) return;
      setSubmitted(null);
      setCorrecting(item);
      setForm({
        photo: item.localPhotoUri ? { uri: item.localPhotoUri } : null,
        description: item.description,
        hazardType: item.hazardType,
        clientReportId: item.clientReportId,
      });
      setManual({ location: item.location, source: item.locationSource });
      setFieldErrors(hazardReportErrorsFromServer(item.fieldErrors));
      setSubmitError(
        `${item.lastError ?? 'The server refused this report'}. Correct the highlighted fields and send it again.`,
      );
      navigation.setParams({ correctClientReportId: undefined });
    });
    return () => {
      current = false;
    };
  }, [correctId, navigation]);

  function clearFieldError(field) {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  // Editing a field clears its error; every other input is kept as typed.
  const update = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
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
    if (!isOnline) {
      await saveOffline();
      return;
    }
    try {
      const photoUrl = form.photo
        ? await uploadApi.uploadImage(form.photo, 'hazard-reports')
        : null;
      const report = await hazardReportsApi.submit({
        description: form.description,
        hazardType: form.hazardType,
        location,
        locationSource,
        photoUrl,
        clientReportId: form.clientReportId,
      });
      if (correcting) {
        await offlineReportQueue.remove(correcting.clientReportId);
        setCorrecting(null);
      }
      setSubmitted(report);
    } catch (error) {
      const body = error?.response?.data?.error;
      if (body?.code === 'VALIDATION_ERROR') {
        // E1.2: the server's field errors outline the same fields.
        setFieldErrors(hazardReportErrorsFromServer(body.errors));
        setSubmitError('Check the highlighted fields.');
      } else if (!error?.response) {
        // A3: the connection dropped on the way - keep the report on the phone.
        await saveOffline();
        return;
      } else {
        setSubmitError(
          body?.message ?? 'Your report could not be sent. Check your connection and try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  // A3.1: keep the report on the phone; SyncService sends it when the
  // connection is back. The photo stays a local file until then.
  async function saveOffline() {
    const fields = {
      clientReportId: form.clientReportId,
      description: form.description,
      hazardType: form.hazardType,
      location,
      locationSource,
      localPhotoUri: form.photo?.uri ?? null,
    };
    try {
      if (correcting) {
        // The corrected report replaces the refused one, ready to send again.
        await offlineReportQueue.update(correcting.clientReportId, {
          ...fields,
          state: 'QUEUED',
          nextAttemptAt: null,
          fieldErrors: [],
          lastError: null,
        });
        setCorrecting(null);
      } else {
        await offlineReportQueue.enqueue(fields);
      }
      setSubmitted({ savedOffline: true });
    } catch (error) {
      setSubmitError(
        error instanceof OfflineQueueFullError
          ? error.message
          : 'Your report could not be saved on this phone. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reportAnother() {
    setSubmitted(null);
    setCorrecting(null);
    setFieldErrors({});
    setForm(emptyForm());
    setManual(null);
    setAutoSheetShown(false);
    gps.retry();
  }

  if (submitted) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Report a Hazard" />
        <SubmittedState
          referenceNo={submitted.referenceNo}
          savedOffline={Boolean(submitted.savedOffline)}
          onViewReports={() => navigation.navigate(TABS.MY_REPORTS)}
          onReportAnother={reportAnother}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll keyboardShouldPersistTaps="handled" contentClassName="pb-10">
      <ScreenHeader title="Report a Hazard" className="px-0" />

      {isOnline ? null : <OfflineBanner />}

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
        status={manual ? 'ready' : gps.status}
        source={locationSource}
        placeName={manual?.placeName}
        onRetry={() => {
          setManual(null);
          gps.retry();
        }}
        onSetManually={() => setSheetOpen(true)}
        error={fieldErrors.location}
      />
      <ManualLocationSheet
        visible={showSheet}
        homeDistrictId={user?.homeDistrict}
        onChoose={(chosen, placeName) => {
          setManual({ location: chosen, placeName });
          setSheetOpen(false);
          setAutoSheetShown(true);
          clearFieldError('location');
        }}
        onClose={() => {
          setSheetOpen(false);
          setAutoSheetShown(true);
        }}
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
