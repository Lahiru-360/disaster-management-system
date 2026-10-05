import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

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
import { uuidv4 } from '../../utils/uuid';

// How long to wait for a GPS fix before giving up (A2 then lets the reporter
// set it by hand - DMS-133).
const LOCATION_TIMEOUT_MS = 15000;

// The current position as { latitude, longitude }, or null when permission is
// refused or there is no fix in time.
async function currentPosition() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return null;
    }
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), LOCATION_TIMEOUT_MS),
      ),
    ]);
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}

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
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('locating');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  // Step 3: the position from the device's location service, or
  // 'unavailable'. State is only set in the lookup's callback.
  function showFix(fix) {
    setLocation(fix);
    setLocationStatus(fix ? 'ready' : 'unavailable');
  }

  useEffect(() => {
    let current = true;
    currentPosition().then((fix) => {
      if (current) showFix(fix);
    });
    return () => {
      current = false;
    };
  }, []);

  function locateAgain() {
    setLocationStatus('locating');
    currentPosition().then(showFix);
  }

  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  // Step 5: upload the photo (§6, folder hazard-reports), then send the
  // report with its URL. The button stays disabled while this runs, so a
  // double tap can't send it twice; the same clientReportId is kept for a
  // retry after a failure.
  async function submit() {
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
      setSubmitError(
        error?.response?.data?.error?.message ??
          'Your report could not be sent. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reportAnother() {
    setSubmitted(null);
    setForm(emptyForm());
    locateAgain();
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
      <PhotoCapture photo={form.photo} onChange={update('photo')} disabled={submitting} />

      <SectionLabel className="mb-2">Location</SectionLabel>
      <LocationRow location={location} status={locationStatus} onRetry={locateAgain} />

      <SectionLabel className="mb-2">Description</SectionLabel>
      <DescriptionField
        value={form.description}
        onChangeText={update('description')}
        disabled={submitting}
      />

      <SectionLabel className="mb-2">Hazard type</SectionLabel>
      <HazardTypeChips
        value={form.hazardType}
        onChange={update('hazardType')}
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
