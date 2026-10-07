import { useId, useRef, useState } from 'react';

import { coordinationApi } from '../../api';
import { apiErrorMessage, mapFieldErrors } from '../../utils/apiErrors';
import Button from '../ui/Button';
import MapView from '../ui/MapView';
import Modal from '../ui/Modal';
import Notice from '../ui/Notice';
import TextInput from '../ui/TextInput';

// The fields the server reports on, with how each reads at the start of its
// message: the server writes "is required", not "Name is required".
const FIELD_LABELS = { name: 'Name', location: 'Location', capacity: 'Capacity' };
const FIELDS = Object.keys(FIELD_LABELS);
const MAP_ZOOM = 11;

// UC03 A1 (§5.1, from step 2): opening a new shelter. The officer gives its
// name, pins its location on the map (with an optional address label such as
// "Ja-Ela") and says how many people it holds. The server checks everything
// and answers per field - a capacity that isn't a whole number of 1 or more,
// a missing name or pin - and refuses a name the district already uses
// (409 SHELTER_NAME_TAKEN, ignoring case and spaces); each shows under its
// field, the typed values stay, and nothing was created. The shelter starts
// empty, so AVAILABLE; `onRegistered` receives it when saved. Mounted only
// while open, so each opening starts fresh.
export default function RegisterShelterDialog({ mapCenter, onClose, onRegistered }) {
  const titleId = useId();
  const nameRef = useRef(null);

  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const [capacityText, setCapacityText] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);

  const clearError = (field) => {
    setError(null);
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      // Sent as typed, not pre-checked here: the server owns the rules.
      const trimmedLabel = label.trim();
      const shelter = await coordinationApi.registerShelter({
        name,
        location: picked
          ? { ...picked, ...(trimmedLabel ? { label: trimmedLabel } : {}) }
          : undefined,
        capacity: capacityText.trim() === '' ? undefined : Number(capacityText),
      });
      onRegistered(shelter);
    } catch (failure) {
      const data = failure?.response?.data?.error;
      const { byField, others } = mapFieldErrors(failure, FIELDS);
      for (const field of Object.keys(byField)) {
        byField[field] = `${FIELD_LABELS[field]} ${byField[field]}`;
      }
      // A taken name is a whole sentence already ("A shelter named ... exists").
      if (data?.code === 'SHELTER_NAME_TAKEN') {
        byField.name = data.message;
      }
      setFieldErrors(byField);
      // Anything that isn't about a field (offline, no active incident, ...) is a Notice.
      if (others.length > 0) {
        setError(others.join(' '));
      } else if (Object.keys(byField).length === 0) {
        setError(apiErrorMessage(failure, 'The shelter could not be registered. Try again.'));
      }
      setSubmitting(false);
      if (byField.name) setTimeout(() => nameRef.current?.focus(), 0);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!submitting}
      labelledBy={titleId}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Register shelter
        </h2>

        <div className="mt-4">
          <TextInput
            label="Name"
            placeholder="e.g. Ja-Ela Central College"
            ref={nameRef}
            value={name}
            error={fieldErrors.name}
            onChange={(event) => {
              setName(event.target.value);
              clearError('name');
            }}
            disabled={submitting}
          />

          <TextInput
            label="Address label (optional)"
            placeholder="e.g. Ja-Ela"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              clearError('location');
            }}
            disabled={submitting}
            containerClassName="mb-2"
          />
          <div className="mb-1 flex items-center gap-3">
            <Button
              variant="small"
              fullWidth={false}
              onClick={() => setMapOpen((open) => !open)}
              disabled={submitting}
            >
              {mapOpen ? 'Hide map' : 'Pin on map'}
            </Button>
            <span className="text-[13px] text-muted" aria-live="polite">
              {picked
                ? `Pinned at ${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`
                : 'No point pinned yet'}
            </span>
          </div>
          {fieldErrors.location ? (
            <p className="mb-2 text-[13px] font-medium text-danger">{fieldErrors.location}</p>
          ) : null}

          {mapOpen ? (
            <MapView
              label="Pick the shelter's location"
              center={mapCenter}
              zoom={mapCenter ? MAP_ZOOM : undefined}
              onPick={(lat, lng) => {
                setPicked({ lat, lng });
                clearError('location');
              }}
              picked={picked}
              className="mt-2 mb-2 h-64"
            />
          ) : null}

          <TextInput
            label="Capacity"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            placeholder="How many people it holds"
            value={capacityText}
            error={fieldErrors.capacity}
            onChange={(event) => {
              setCapacityText(event.target.value);
              clearError('capacity');
            }}
            disabled={submitting}
            containerClassName="mt-3"
          />
        </div>

        {error ? (
          <Notice variant="error" className="mt-1">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" fullWidth={false} onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" fullWidth={false} loading={submitting}>
            Register
          </Button>
        </div>
      </form>
    </Modal>
  );
}
