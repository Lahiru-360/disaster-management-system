import { useEffect, useId, useState } from 'react';

import { reportsApi } from '../../api';
import { apiErrorMessage, mapFieldErrors } from '../../utils/apiErrors';
import Button from '../ui/Button';
import ChipGroup from '../ui/ChipGroup';
import Loader from '../ui/Loader';
import Modal from '../ui/Modal';
import Notice from '../ui/Notice';
import Select from '../ui/Select';
import TextArea from '../ui/TextArea';
import TextInput from '../ui/TextInput';

const FORMATS = [
  { value: 'PDF', label: 'PDF' },
  { value: 'CSV', label: 'CSV' },
];
const DEFAULT_MESSAGE = 'Post-event summary';
const MESSAGE_MAX = 500;
const FIELDS = ['organisationId', 'recipientEmail', 'message', 'format'];
// Only a shape check, to catch typos before the call; the server decides.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UC04 steps 14-15 (§5.2, DMS-155.5): the Share report dialog - an
// Organisation select (picking one pre-fills its contact email when it has
// one), a Recipient email, a Format (PDF by default) and a Message ("Post-event
// summary" by default), then Cancel / Share. Share sends the choice to the
// server, which makes the export first if the report has none in that format,
// emails the link and records the share; `onShared` receives the recorded
// share (§14.9). A refusal is shown on its field, or as a notice when it isn't
// about one (the email provider being down, offline ...) and the dialog stays
// open with what was typed. Mounted only while open, so each opening starts
// fresh.
export default function ShareDialog({ reportId, onClose, onShared }) {
  const titleId = useId();

  // null while loading; the organisations once loaded.
  const [organisations, setOrganisations] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [organisationId, setOrganisationId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [format, setFormat] = useState('PDF');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let current = true;
    reportsApi.listOrganisations().then(
      (rows) => {
        if (current) setOrganisations(rows);
      },
      (failure) => {
        if (current) {
          setLoadError(apiErrorMessage(failure, 'The organisations could not be loaded.'));
        }
      },
    );
    return () => {
      current = false;
    };
  }, []);

  const clearErrors = (field) => {
    setError(null);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleOrganisationChange = (event) => {
    const next = event.target.value;
    setOrganisationId(next);
    // The contact email, when the organisation has one, else the field is emptied.
    setRecipientEmail(organisations.find((o) => o.id === next)?.contactEmail ?? '');
    setFieldErrors((current) => ({
      ...current,
      organisationId: undefined,
      recipientEmail: undefined,
    }));
    setError(null);
  };

  const canShare = Boolean(organisationId && recipientEmail.trim() && message.trim());

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !canShare) return;
    const email = recipientEmail.trim();
    if (!EMAIL_PATTERN.test(email)) {
      setFieldErrors({ recipientEmail: 'Enter a valid email address.' });
      return;
    }
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const share = await reportsApi.shareReport(reportId, {
        format,
        organisationId,
        recipientEmail: email,
        message: message.trim(),
      });
      onShared(share);
    } catch (failure) {
      const { byField, others } = mapFieldErrors(failure, FIELDS);
      setFieldErrors(byField);
      // Anything that isn't about a field (offline, 502, 404 ...) is a Notice.
      if (others.length > 0) {
        setError(others.join(' '));
      } else if (Object.keys(byField).length === 0) {
        setError(apiErrorMessage(failure, 'The report could not be shared. Try again.'));
      }
      setSubmitting(false);
    }
  };

  let body;
  if (loadError) {
    body = <Notice variant="error">{loadError}</Notice>;
  } else if (!organisations) {
    body = <Loader className="my-6" />;
  } else {
    body = (
      <>
        <Select
          label="Organisation"
          placeholder="Select an organisation"
          value={organisationId}
          onChange={handleOrganisationChange}
          error={fieldErrors.organisationId}
          disabled={submitting}
          options={organisations.map((o) => ({ value: o.id, label: o.name }))}
        />
        <TextInput
          label="Recipient email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={recipientEmail}
          error={fieldErrors.recipientEmail}
          onChange={(event) => {
            setRecipientEmail(event.target.value);
            clearErrors('recipientEmail');
          }}
          disabled={submitting}
        />
        <div className="mb-4">
          <p id={`${titleId}-format`} className="mb-1.5 text-[13px] font-semibold text-ink">
            Format
          </p>
          <ChipGroup
            aria-labelledby={`${titleId}-format`}
            options={FORMATS}
            value={format}
            // A format is always chosen: tapping the chosen one keeps it.
            onChange={(next) => setFormat(next ?? format)}
          />
          {fieldErrors.format ? (
            <p className="mt-1.5 text-[13px] font-medium text-danger">{fieldErrors.format}</p>
          ) : null}
        </div>
        <TextArea
          label="Message"
          rows={3}
          maxLength={MESSAGE_MAX}
          value={message}
          error={fieldErrors.message}
          onChange={(event) => {
            setMessage(event.target.value);
            clearErrors('message');
          }}
          disabled={submitting}
        />
        {error ? <Notice variant="error">{error}</Notice> : null}
      </>
    );
  }

  return (
    <Modal open onClose={onClose} dismissable={!submitting} labelledBy={titleId}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Share report
        </h2>

        <div className="mt-4">{body}</div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" fullWidth={false} onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" fullWidth={false} loading={submitting} disabled={!canShare}>
            Share
          </Button>
        </div>
      </form>
    </Modal>
  );
}
