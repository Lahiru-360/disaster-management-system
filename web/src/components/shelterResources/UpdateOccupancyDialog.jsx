import { useId, useState } from 'react';

import { coordinationApi } from '../../api';
import { apiErrorMessage } from '../../utils/apiErrors';
import {
  occupancyPercent,
  SHELTER_STATUS_LABELS,
  SHELTER_STATUS_TONES,
  shelterStatusFor,
} from '../../utils/shelterStatus';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Notice from '../ui/Notice';
import Select from '../ui/Select';
import StatusBadge from '../ui/StatusBadge';
import TextInput from '../ui/TextInput';

// The wireframe's "(!)" marks the two statuses the officer must act on (A2).
const NEEDS_ATTENTION = ['NEAR_CAPACITY', 'FULL'];

// A whole number, 0 or more: what the server accepts. Anything else shows no
// preview here and is left for the server's E1 answer to explain.
function parseOccupants(text) {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

// UC03 main flow steps 3-5 (§5.1): pick a shelter (the row clicked, to begin
// with), type how many people are in it now, and see the occupancy and status
// it will have while typing. The preview uses the server's thresholds
// (utils/shelterStatus) but only previews: Update sends the number, and the
// server's `{ shelter, rate, status }` answer is what `onUpdated` receives.
// Mounted only while open, so each opening starts fresh.
export default function UpdateOccupancyDialog({ shelters, initialShelterId, onClose, onUpdated }) {
  const titleId = useId();
  const startAt = shelters.find((s) => s.id === initialShelterId) ?? shelters[0];

  const [shelterId, setShelterId] = useState(startAt?.id ?? '');
  const [occupantsText, setOccupantsText] = useState(String(startAt?.currentOccupancy ?? ''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const shelter = shelters.find((s) => s.id === shelterId);
  const occupants = parseOccupants(occupantsText);
  const previewStatus =
    shelter && occupants !== null ? shelterStatusFor(occupants, shelter.capacity) : null;

  const handleShelterChange = (event) => {
    const next = shelters.find((s) => s.id === event.target.value);
    setShelterId(event.target.value);
    setOccupantsText(String(next?.currentOccupancy ?? ''));
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !shelter || occupantsText.trim() === '') return;
    setSubmitting(true);
    setError(null);
    try {
      // Sent as typed, not pre-checked here: the server owns E1's validation.
      const result = await coordinationApi.updateOccupancy(shelter.id, Number(occupantsText));
      onUpdated(result);
    } catch (failure) {
      setError(apiErrorMessage(failure, 'The occupancy could not be updated. Try again.'));
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} dismissable={!submitting} labelledBy={titleId}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Update Shelter Occupancy
        </h2>

        <div className="mt-4">
          <Select
            label="Shelter"
            value={shelterId}
            onChange={handleShelterChange}
            disabled={submitting}
            options={shelters.map((s) => ({ value: s.id, label: s.name }))}
          />
          <TextInput
            label="Capacity"
            value={shelter ? String(shelter.capacity) : ''}
            readOnly
            disabled
          />
          <TextInput
            label="Current occupants"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={occupantsText}
            onChange={(event) => {
              setOccupantsText(event.target.value);
              setError(null);
            }}
            disabled={submitting}
            containerClassName="mb-3"
          />
        </div>

        <div className="min-h-7" aria-live="polite">
          {previewStatus ? (
            <StatusBadge tone={SHELTER_STATUS_TONES[previewStatus]}>
              {NEEDS_ATTENTION.includes(previewStatus) ? '(!) ' : ''}
              {occupancyPercent(occupants, shelter.capacity)}% –{' '}
              {SHELTER_STATUS_LABELS[previewStatus]}
            </StatusBadge>
          ) : null}
        </div>

        {error ? (
          <Notice variant="error" className="mt-3">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" fullWidth={false} onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            fullWidth={false}
            loading={submitting}
            disabled={!shelter || occupantsText.trim() === ''}
          >
            Update
          </Button>
        </div>
      </form>
    </Modal>
  );
}
