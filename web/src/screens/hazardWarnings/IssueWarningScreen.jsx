import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { areasApi, hazardAlertsApi } from '../../api';
import BroadcastPreview from '../../components/hazardWarnings/BroadcastPreview';
import ChannelReadiness from '../../components/hazardWarnings/ChannelReadiness';
import HazardTypePicker from '../../components/hazardWarnings/HazardTypePicker';
import RecipientCount from '../../components/hazardWarnings/RecipientCount';
import ScopeSelector from '../../components/hazardWarnings/ScopeSelector';
import SeverityPicker from '../../components/hazardWarnings/SeverityPicker';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import StatusBadge from '../../components/ui/StatusBadge';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { apiErrorMessage, mapFieldErrors } from '../../utils/apiErrors';

// How long the choices must stay still before the preview is asked for, so
// ticking several areas in a row makes one request.
const PREVIEW_DELAY_MS = 400;

// The preview field this form highlights (the Target scope card); an error
// on any other field goes in a Notice above the form.
const SCOPE_FIELDS = ['areaIds'];

// UC01 main flow steps 1-8 (§5.1), the IssueWarningScreen of the sequence
// diagram. Opening it starts a DRAFT (step 2). Once a hazard type, a severity
// and at least one area are chosen (steps 3-5), the server validates the
// scope, counts the citizens and writes the message (steps 6-7), shown on the
// right, where the officer can edit it (step 8). Nothing is sent from here
// until Confirm & Broadcast (DMS-121).
export default function IssueWarningScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canIssue = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const [alert, setAlert] = useState(null);
  const [areas, setAreas] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [hazardType, setHazardType] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [areaIds, setAreaIds] = useState([]);

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [message, setMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [messageError, setMessageError] = useState(null);

  // A remount in development must not open a second draft.
  const started = useRef(false);
  // Only the newest preview request may update the screen.
  const previewRequest = useRef(0);

  const alertId = alert?.id;
  const complete = Boolean(hazardType && severity && areaIds.length > 0);

  // Steps 1-2: open a DRAFT, and load the areas to choose from.
  useEffect(() => {
    if (!canIssue || started.current) return;
    started.current = true;
    Promise.all([
      hazardAlertsApi.startDraft(),
      areasApi.listDistricts(),
      areasApi.listRiverBasins(),
    ]).then(
      ([draft, districts, riverBasins]) => {
        setAlert(draft.alert);
        setAreas({ districts, riverBasins });
      },
      (error) =>
        setLoadError(apiErrorMessage(error, 'The warning could not be opened. Try again.')),
    );
  }, [canIssue]);

  // Steps 6-7: preview whenever the choices are complete and have settled.
  useEffect(() => {
    const request = ++previewRequest.current;
    if (!alertId || !complete) return undefined;

    const timer = setTimeout(() => {
      setPreviewing(true);
      hazardAlertsApi
        .preview(alertId, { hazardType, severity, areaIds })
        .then(
          (result) => {
            if (request !== previewRequest.current) return;
            setPreview(result);
            setAlert(result.alert);
            setMessage(result.message);
            setSavedMessage(result.message);
            setMessageError(null);
            setPreviewError(null);
          },
          (error) => {
            if (request !== previewRequest.current) return;
            setPreview(null);
            setPreviewError(error);
          },
        )
        .finally(() => {
          if (request === previewRequest.current) setPreviewing(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [alertId, complete, hazardType, severity, areaIds]);

  // E1.2: back at step 5, the refused scope's message clears as soon as the
  // officer changes the scope.
  function changeScope(ids) {
    setAreaIds(ids);
    setPreviewError(null);
  }

  // Step 8: save an edited message to the draft when the officer leaves it.
  async function saveMessage() {
    const text = message.trim();
    if (text === savedMessage) return;
    if (!text) {
      setMessageError('The message cannot be empty.');
      return;
    }
    try {
      const saved = await hazardAlertsApi.saveDraftMessage(alertId, text);
      setAlert(saved.alert);
      setMessage(saved.alert.message);
      setSavedMessage(saved.alert.message);
      setMessageError(null);
    } catch (error) {
      setMessageError(
        mapFieldErrors(error, ['message']).byField.message ??
          apiErrorMessage(error, 'The message could not be saved. Try again.'),
      );
    }
  }

  if (!canIssue) {
    return (
      <Screen>
        <ScreenHeader title="Issue Hazard Warning" />
        <Notice className="mt-4">Issuing hazard warnings needs a DMC or duty officer.</Notice>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <ScreenHeader title="Issue Hazard Warning" />
        <Notice variant="error" className="mt-4">
          {loadError}
        </Notice>
      </Screen>
    );
  }

  if (!alert || !areas) {
    return (
      <Screen>
        <ScreenHeader title="Issue Hazard Warning" />
        <Loader className="mt-10" />
      </Screen>
    );
  }

  // E1: a scope the server refused is shown on the Target scope card, with
  // every choice kept, so the officer corrects it and the preview runs again.
  const { byField, others } = mapFieldErrors(previewError, SCOPE_FIELDS);
  const scopeError = byField.areaIds ? `Check the target scope – ${byField.areaIds}` : null;
  let otherPreviewError = null;
  if (others.length > 0) otherPreviewError = others.join('; ');
  else if (previewError && !scopeError) {
    otherPreviewError = apiErrorMessage(previewError, 'The preview could not be made. Try again.');
  }

  return (
    <Screen>
      <ScreenHeader title="Issue Hazard Warning" />

      {otherPreviewError ? (
        <Notice variant="error" className="mt-4">
          {otherPreviewError}
        </Notice>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionLabel>1. Hazard type</SectionLabel>
          <div className="mt-2.5">
            <HazardTypePicker value={hazardType} onChange={setHazardType} />
          </div>
          <SectionLabel className="mt-5">Severity</SectionLabel>
          <div className="mt-2.5">
            <SeverityPicker value={severity} onChange={setSeverity} />
          </div>

          <SectionLabel className="mt-7">2. Target scope</SectionLabel>
          <div className="mt-2.5">
            <ScopeSelector
              districts={areas.districts}
              riverBasins={areas.riverBasins}
              value={areaIds}
              onChange={changeScope}
              error={scopeError}
            />
          </div>
        </Card>

        <Card aria-busy={previewing || undefined}>
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>3. Broadcast preview (editable)</SectionLabel>
            {previewing ? (
              <span
                role="status"
                aria-label="Updating the preview"
                className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent"
              />
            ) : null}
          </div>

          {!complete ? (
            <p className="mt-3 text-[14px] text-muted">
              Choose a hazard type, a severity and at least one area to preview the warning.
            </p>
          ) : !preview ? (
            previewing ? (
              <Loader className="mt-6" />
            ) : (
              <p className="mt-3 text-[14px] text-muted">
                {scopeError
                  ? 'Correct the target scope to preview the warning.'
                  : 'The preview will appear here once it can be made.'}
              </p>
            )
          ) : (
            <>
              <div className="mt-3">
                <BroadcastPreview
                  value={message}
                  onChange={setMessage}
                  onBlur={saveMessage}
                  error={messageError}
                />
              </div>
              <div className="mt-4 border-t border-line pt-2">
                <ChannelReadiness channels={preview.channels} />
              </div>
              <div className="mt-2 border-t border-line pt-4">
                <RecipientCount count={preview.recipientCount} />
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-[14px] text-muted">Status:</span>
        <StatusBadge tone="neutral">{alert.status}</StatusBadge>
        <div className="ml-auto flex gap-3">
          <Button variant="outline" fullWidth={false} onClick={() => navigate('/hazard-warnings')}>
            Cancel
          </Button>
          {/* The confirmation dialog and the broadcast arrive with DMS-121.7. */}
          <Button fullWidth={false} disabled>
            Confirm &amp; Broadcast
          </Button>
        </div>
      </Card>
    </Screen>
  );
}
