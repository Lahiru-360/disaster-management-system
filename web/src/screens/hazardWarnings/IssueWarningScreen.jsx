import { Send, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { areasApi, hazardAlertsApi } from '../../api';
import ActiveWarningBanner from '../../components/hazardWarnings/ActiveWarningBanner';
import BroadcastPreview from '../../components/hazardWarnings/BroadcastPreview';
import ChannelReadiness from '../../components/hazardWarnings/ChannelReadiness';
import ConfirmBroadcastDialog from '../../components/hazardWarnings/ConfirmBroadcastDialog';
import HazardTypePicker, { HAZARD_TYPES } from '../../components/hazardWarnings/HazardTypePicker';
import RecipientCount from '../../components/hazardWarnings/RecipientCount';
import ScopeSelector from '../../components/hazardWarnings/ScopeSelector';
import SeverityPicker from '../../components/hazardWarnings/SeverityPicker';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Loader from '../../components/ui/Loader';
import MapView from '../../components/ui/MapView';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { apiErrorMessage, mapFieldErrors } from '../../utils/apiErrors';

// How long the choices must stay still before the preview is asked for, so
// ticking several areas in a row makes one request.
const PREVIEW_DELAY_MS = 400;

// The preview field this form highlights (the Target scope card); an error
// on any other field goes in a Notice above the form.
const SCOPE_FIELDS = ['areaIds'];

// A warning in force, which can be updated (A2).
const ACTIVE_STATUSES = ['BROADCAST', 'UPDATED'];

// A scope as a key that ignores the order the areas were chosen in.
const scopeKey = (ids) => [...new Set(ids)].sort().join(',');

const SUBTITLE =
  'Broadcast a location-specific hazard warning to citizens in the affected districts. Alerts are delivered by push notification, SMS and audible alert simultaneously.';

// A form card's heading: "1 Hazard Type", with the number in a navy square.
function StepHeading({ step, children }) {
  return (
    <h2 className="flex items-center gap-2.5 text-[17px] font-bold text-ink">
      {step ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy text-[12px] text-paper">
          {step}
        </span>
      ) : null}
      {children}
    </h2>
  );
}

// The chosen areas as pins on the map beside the scope list: a district at
// its centroid, a river basin at each of its districts'. Areas without a
// centroid (the mock geography) are simply not pinned.
function scopeMarkers(areaIds, areas) {
  const districtById = new Map(areas.districts.map((district) => [district.id, district]));
  const basinById = new Map(areas.riverBasins.map((basin) => [basin.id, basin]));
  const pinned = new Map();
  for (const id of areaIds) {
    const districts = districtById.has(id)
      ? [districtById.get(id)]
      : (basinById.get(id)?.districts ?? []).map(
          (district) => districtById.get(district.id) ?? district,
        );
    for (const district of districts) {
      if (district.centroid && !pinned.has(district.id)) {
        pinned.set(district.id, {
          id: district.id,
          lat: district.centroid.lat,
          lng: district.centroid.lng,
          type: 'incident',
          tone: 'danger',
          label: district.name,
        });
      }
    }
  }
  return [...pinned.values()];
}

// UC01 main flow steps 1-8 (§5.1), the IssueWarningScreen of the sequence
// diagram. Opening it starts a DRAFT (step 2). Once a hazard type, a severity
// and at least one area are chosen (steps 3-5), the server validates the
// scope, counts the citizens and writes the message (steps 6-7), shown on the
// right, where the officer can edit it (step 8). Confirm & Broadcast opens the
// confirmation dialog (steps 9-10); Broadcast now sends it (steps 11-13) and
// moves on to the delivery summary (step 14). Opened with `?reportId=` (A1,
// DMS-122), it escalates that confirmed report: the draft is linked to it, the
// suggested hazard type and district are pre-selected, and the officer goes on
// from step 4 (severity).
//
// A4: Back in the dialog only closes it, so every input stays. Cancel offers
// to discard the draft; leaving any other way keeps it, and the Drafts list
// reopens it here with ?draftId=.
//
// A2: when the preview finds an active warning of the same type in the scope,
// a banner offers Update existing instead of a duplicate broadcast. That opens
// this screen in edit mode at /hazard-warnings/:id/edit?replaces=<draft id>,
// headed "Updating HA-1043 (v2)": the hazard type is fixed, the severity and
// scope are pre-loaded, and each change is previewed against the recalculated
// recipients (§12.13) without changing the warning. Confirm & Update sends it
// (§12.14), and the new draft it replaces is then discarded by the server.
export default function IssueWarningScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const editing = Boolean(editId);
  const draftId = searchParams.get('draftId');
  const sourceReportId = searchParams.get('reportId');
  const replacesDraftId = searchParams.get('replaces');
  const recipientCountId = useId();
  const canIssue = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);

  const [alert, setAlert] = useState(null);
  const [prefill, setPrefill] = useState(null);
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

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState(null);

  const [discarding, setDiscarding] = useState(false);
  const [removing, setRemoving] = useState(false);

  // A remount in development must not open a second draft.
  const started = useRef(false);
  // Only the newest preview request may update the screen.
  const previewRequest = useRef(0);
  // A resumed draft's message, which may be the officer's edit: the first
  // preview for the same type and severity puts it back instead of the
  // generated one.
  const resumedMessage = useRef(null);

  const alertId = alert?.id;
  const complete = Boolean(hazardType && severity && areaIds.length > 0);
  // A2.2: an update must change the severity or the scope.
  const scopeChanged =
    editing && alert ? scopeKey(areaIds) !== scopeKey(alert.targets.map(({ id }) => id)) : false;
  const changed = !editing || (alert && (severity !== alert.severity || scopeChanged));
  const title = editing && alert ? `Updating ${alert.referenceNo} (v${alert.version + 1})` : null;

  // Steps 1-2: open a DRAFT, or reopen the one being resumed (A4), and load
  // the areas to choose from. A1.2: an escalated report's suggestions are
  // pre-selected. A2: open the active warning being updated instead.
  useEffect(() => {
    if (!canIssue || started.current) return;
    started.current = true;
    let opening;
    if (editId) opening = hazardAlertsApi.getById(editId);
    else if (draftId) opening = hazardAlertsApi.getById(draftId);
    else opening = hazardAlertsApi.startDraft(sourceReportId ? { sourceReportId } : undefined);
    Promise.all([opening, areasApi.listDistricts(), areasApi.listRiverBasins()]).then(
      ([draft, districts, riverBasins]) => {
        const opened = draft.alert;
        if (editId && !ACTIVE_STATUSES.includes(opened.status)) {
          setLoadError(`${opened.referenceNo} can't be updated: it is ${opened.status}.`);
          return;
        }
        if (!editId && opened.status !== 'DRAFT') {
          setLoadError(`${opened.referenceNo} is no longer a draft: it is ${opened.status}.`);
          return;
        }
        setAlert(opened);
        setAreas({ districts, riverBasins });
        setHazardType(opened.hazardType);
        setSeverity(opened.severity);
        setAreaIds(opened.targets.map(({ id }) => id));
        // An update starts from the update message the preview writes.
        if (opened.message && !editId) {
          resumedMessage.current = {
            hazardType: opened.hazardType,
            severity: opened.severity,
            message: opened.message,
          };
        }
        if (draft.prefill) {
          setPrefill(draft.prefill);
          setHazardType(draft.prefill.hazardType);
          setAreaIds([draft.prefill.districtId]);
        }
      },
      (error) =>
        setLoadError(apiErrorMessage(error, 'The warning could not be opened. Try again.')),
    );
  }, [canIssue, editId, draftId, sourceReportId]);

  // Steps 6-7: preview whenever the choices are complete and have settled.
  useEffect(() => {
    const request = ++previewRequest.current;
    if (!alertId || !complete) return undefined;

    const timer = setTimeout(() => {
      setPreviewing(true);
      (editing
        ? hazardAlertsApi.previewUpdate(alertId, { severity, areaIds })
        : hazardAlertsApi.preview(alertId, { hazardType, severity, areaIds })
      )
        .then(
          (result) => {
            if (request !== previewRequest.current) return;
            const resumed = resumedMessage.current;
            resumedMessage.current = null;
            setPreview(result);
            setAlert(result.alert);
            setMessage(result.message);
            setSavedMessage(result.message);
            setMessageError(null);
            setPreviewError(null);
            if (
              resumed &&
              resumed.hazardType === hazardType &&
              resumed.severity === severity &&
              resumed.message !== result.message
            ) {
              // The preview wrote the generated message; save the edit back.
              setMessage(resumed.message);
              hazardAlertsApi.saveDraftMessage(alertId, resumed.message).then(
                (saved) => {
                  setAlert(saved.alert);
                  setSavedMessage(saved.alert.message);
                },
                // Shown as edited, so leaving the field saves it again.
                () => {},
              );
            }
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
  }, [alertId, editing, complete, hazardType, severity, areaIds]);

  // E1.2: back at step 5, the refused scope's message clears as soon as the
  // officer changes the scope.
  function changeScope(ids) {
    setAreaIds(ids);
    setPreviewError(null);
  }

  // Step 8: save an edited message to the draft when the officer leaves it.
  // An update's message has no draft to go to: it is sent with the update.
  async function saveMessage() {
    const text = message.trim();
    if (!text) {
      setMessageError('The message cannot be empty.');
      return;
    }
    if (editing || text === savedMessage) {
      setMessageError(null);
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

  // Steps 11-14: send the message as the officer last saw it, then show the
  // delivery summary. A failure closes the dialog; nothing was sent. A2.3:
  // an update sends only what changed, and names the draft it replaces.
  async function broadcast() {
    setSending(true);
    try {
      const result = editing
        ? await hazardAlertsApi.update(alertId, {
            severity: severity === alert.severity ? undefined : severity,
            areaIds: scopeChanged ? areaIds : undefined,
            message: message.trim(),
            replacesDraftId: replacesDraftId ?? undefined,
          })
        : await hazardAlertsApi.broadcast(alertId, message.trim());
      navigate(`/hazard-warnings/${alertId}`, { state: result });
    } catch (error) {
      setSending(false);
      setConfirming(false);
      const messageFieldError = mapFieldErrors(error, ['message']).byField.message;
      if (messageFieldError) setMessageError(messageFieldError);
      else {
        setBroadcastError(
          apiErrorMessage(
            error,
            editing
              ? 'The update could not be sent. Try again.'
              : 'The warning could not be broadcast. Try again.',
          ),
        );
      }
    }
  }

  // A4: throw the draft away and go back to the list. Nothing was sent.
  async function discard() {
    setRemoving(true);
    try {
      await hazardAlertsApi.discardDraft(alertId);
      navigate('/hazard-warnings');
    } catch (error) {
      setRemoving(false);
      setDiscarding(false);
      setBroadcastError(apiErrorMessage(error, 'The draft could not be discarded. Try again.'));
    }
  }

  if (!canIssue) {
    return (
      <Screen>
        <ScreenHeader title={editing ? 'Update Hazard Warning' : 'Issue Hazard Warning'} />
        <Notice className="mt-4">Issuing hazard warnings needs a DMC or duty officer.</Notice>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <ScreenHeader title={editing ? 'Update Hazard Warning' : 'Issue Hazard Warning'} />
        <Notice variant="error" className="mt-4">
          {loadError}
        </Notice>
        <div className="mt-6">
          <Button variant="outline" fullWidth={false} onClick={() => navigate('/hazard-warnings')}>
            Back to Hazard Warnings
          </Button>
        </div>
      </Screen>
    );
  }

  if (!alert || !areas) {
    return (
      <Screen>
        <ScreenHeader title={editing ? 'Update Hazard Warning' : 'Issue Hazard Warning'} />
        <Loader className="mt-10" />
      </Screen>
    );
  }

  // E1: a scope the server refused is shown on the Target scope card, with
  // every choice kept, so the officer corrects it and the preview runs again.
  const { byField, others } = mapFieldErrors(previewError, SCOPE_FIELDS);
  const scopeError = byField.areaIds ? `Check the target scope – ${byField.areaIds}` : null;
  // E2: a scope with no registered citizens cannot be broadcast. The officer
  // changes the scope (step 5) and the preview runs again.
  const noRecipients = preview?.recipientCount === 0;
  let otherPreviewError = null;
  if (others.length > 0) otherPreviewError = others.join('; ');
  else if (previewError && !scopeError) {
    otherPreviewError = apiErrorMessage(previewError, 'The preview could not be made. Try again.');
  }
  // A2.1: an active warning of the same type already covers the scope.
  const activeWarning = preview?.activeWarning ?? null;
  // Step 9: only a complete, previewed draft with citizens to reach, no
  // active warning to duplicate and a message can be broadcast; an update
  // must also change something.
  const canBroadcast = Boolean(
    complete &&
    changed &&
    preview &&
    !previewing &&
    preview.recipientCount > 0 &&
    !activeWarning &&
    message.trim() &&
    !messageError,
  );
  // What the confirmation dialog announces: for an update, the new severity
  // and scope rather than the warning as it stands.
  const nameOf = new Map(
    [...areas.districts, ...areas.riverBasins].map(({ id, name }) => [id, name]),
  );
  const confirmed = editing
    ? { ...alert, severity, targets: areaIds.map((id) => ({ id, name: nameOf.get(id) ?? id })) }
    : alert;

  // Cancel: a draft may be discarded (A4). An update has nothing to discard,
  // so it goes back to the draft it would replace, or to the warning.
  function cancel() {
    setBroadcastError(null);
    if (!editing) setDiscarding(true);
    else if (replacesDraftId) navigate(`/hazard-warnings/new?draftId=${replacesDraftId}`);
    else navigate(`/hazard-warnings/${alertId}`);
  }

  return (
    <Screen>
      <ScreenHeader title={title ?? 'Issue Hazard Warning'} />
      <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-muted">{SUBTITLE}</p>

      {prefill ? (
        <Notice icon="i" className="mt-4">
          Pre-filled from confirmed report{' '}
          <Link
            to={`/ground-reports?reportId=${prefill.reportRef.id}`}
            className="font-bold underline"
          >
            {prefill.reportRef.referenceNo}
          </Link>
        </Notice>
      ) : null}

      {activeWarning ? (
        <ActiveWarningBanner
          className="mt-4"
          warning={activeWarning}
          onUpdate={
            editing
              ? undefined
              : () => navigate(`/hazard-warnings/${activeWarning.id}/edit?replaces=${alertId}`)
          }
        />
      ) : null}

      {otherPreviewError ? (
        <Notice variant="error" className="mt-4">
          {otherPreviewError}
        </Notice>
      ) : null}
      {broadcastError ? (
        <Notice variant="error" className="mt-4">
          {broadcastError}
        </Notice>
      ) : null}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Card className="p-6">
            <StepHeading step={1}>Hazard Type</StepHeading>
            <div className="mt-4">
              {editing ? (
                // A different hazard is a new warning, so an update keeps the type.
                <p className="text-[14px] text-ink">
                  <strong>
                    {HAZARD_TYPES.find(({ value }) => value === hazardType)?.label ?? hazardType}
                  </strong>
                  <span className="text-muted"> – an update keeps the hazard type</span>
                </p>
              ) : (
                <HazardTypePicker value={hazardType} onChange={setHazardType} />
              )}
            </div>
            {prefill && !prefill.hazardType && !hazardType ? (
              <p className="mt-2 text-[13px] text-muted">
                Ground-impact report – choose the hazard type
              </p>
            ) : null}
            <h3 className="mt-6 text-[14px] font-bold text-ink">Severity Level</h3>
            <div className="mt-3">
              <SeverityPicker value={severity} onChange={setSeverity} />
            </div>
          </Card>

          <Card className="p-6">
            <StepHeading step={2}>Target Scope</StepHeading>
            <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
              <ScopeSelector
                districts={areas.districts}
                riverBasins={areas.riverBasins}
                value={areaIds}
                onChange={changeScope}
                error={scopeError}
              />
              <MapView
                label="Target scope map"
                markers={scopeMarkers(areaIds, areas)}
                className="h-72 md:h-auto md:min-h-72"
              />
            </div>
          </Card>
        </div>

        <section
          aria-busy={previewing || undefined}
          aria-label="Broadcast preview"
          className="rounded-2xl bg-navy p-6 text-paper xl:sticky xl:top-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold">Broadcast Preview</h2>
            {previewing ? (
              <span
                role="status"
                aria-label="Updating the preview"
                className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent"
              />
            ) : null}
          </div>

          {!complete ? (
            <p className="mt-4 text-[14px] text-muted-dark">
              Choose a hazard type, a severity and at least one area to preview the warning.
            </p>
          ) : !preview ? (
            previewing ? (
              <Loader className="mt-6" />
            ) : (
              <p className="mt-4 text-[14px] text-muted-dark">
                {scopeError
                  ? 'Correct the target scope to preview the warning.'
                  : 'The preview will appear here once it can be made.'}
              </p>
            )
          ) : (
            <>
              <div className="mt-5 rounded-2xl bg-ink/40 p-3">
                <div className="flex gap-3 rounded-xl bg-paper p-4 text-ink">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-danger text-paper">
                    <TriangleAlert size={22} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="px-2 text-[15px] font-bold">
                      {HAZARD_TYPES.find(({ value }) => value === hazardType)?.label ?? hazardType}{' '}
                      Warning : {severity}
                    </p>
                    <BroadcastPreview
                      value={message}
                      onChange={setMessage}
                      onBlur={saveMessage}
                      error={messageError}
                    />
                    <p className="px-2 text-[12px] text-muted">DMC Alert – now</p>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <ChannelReadiness channels={preview.channels} />
              </div>
              <div className="mt-6 border-t border-navy-hi pt-5">
                <RecipientCount id={recipientCountId} count={preview.recipientCount} />
              </div>
            </>
          )}
        </section>
      </div>

      <div className="mt-8 -mx-8 -mb-7 flex flex-wrap items-center gap-3 border-t border-line bg-paper px-8 py-4">
        <span className="text-[14px] text-muted">
          Status: <strong className="text-ink">{alert.status}</strong>
        </span>
        {changed ? null : (
          <span className="text-[13px] text-muted">
            Change the severity or the scope to send an update.
          </span>
        )}
        <div className="ml-auto flex gap-3">
          <Button variant="outline" fullWidth={false} onClick={cancel}>
            Cancel
          </Button>
          {/* With no recipients (E2) the disabled button points at the reason. */}
          <Button
            variant="danger"
            fullWidth={false}
            disabled={!canBroadcast}
            aria-describedby={noRecipients ? recipientCountId : undefined}
            onClick={() => {
              setBroadcastError(null);
              setConfirming(true);
            }}
          >
            <Send size={17} aria-hidden="true" />
            {editing ? 'Confirm & Update' : 'Confirm & Broadcast'}
          </Button>
        </div>
      </div>

      {preview ? (
        <ConfirmBroadcastDialog
          open={confirming}
          alert={confirmed}
          recipientCount={preview.recipientCount}
          channels={preview.channels}
          isUpdate={editing}
          sending={sending}
          onConfirm={broadcast}
          onBack={() => setConfirming(false)}
        />
      ) : null}

      <ConfirmDialog
        open={discarding}
        title="Discard draft"
        confirmLabel="Discard draft"
        backLabel="Keep editing"
        destructive
        loading={removing}
        dismissable={!removing}
        onConfirm={discard}
        onBack={() => setDiscarding(false)}
      >
        <p>Discard this draft? Nothing has been sent.</p>
      </ConfirmDialog>
    </Screen>
  );
}
