import { useEffect, useId, useRef, useState } from 'react';

import { coordinationApi } from '../../api';
import { apiErrorMessage, mapFieldErrors } from '../../utils/apiErrors';
import { supplyTypeLabel } from '../../utils/supplyTypes';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import Modal from '../ui/Modal';
import Notice from '../ui/Notice';
import Select from '../ui/Select';
import TextInput from '../ui/TextInput';

// The organisations that hold stock, once each, in the order the rows come.
function organisationsIn(stock) {
  const seen = new Map();
  stock.forEach((row) => seen.set(row.organisation.id, row.organisation));
  return [...seen.values()];
}

// UC03 steps 12-13 (§5.2): pick the owning organisation, one of the supply
// types it holds in this district, a quantity and the receiving shelter. The
// stock it comes from is always shown ("Available stock 1,200 bottles") and
// follows the two selects. Save sends `{ shelterId, stockId, quantity }`; the
// server checks the quantity against the stock and `onLogged` receives its
// `{ distribution, stock }` answer. E5 (DMS-151): when the server refuses the
// quantity (0 or less, or more than is held), its message - which shows what is
// available - appears under Quantity, the typed value stays, the stock figure
// is refreshed in case someone else took some, and nothing was saved. Mounted
// only while open, so each opening starts fresh.
export default function LogReliefSupplyDialog({ shelters, onClose, onLogged }) {
  const titleId = useId();

  // null while loading; the rows (maybe none) once loaded.
  const [stock, setStock] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [organisationId, setOrganisationId] = useState('');
  const [supplyType, setSupplyType] = useState('');
  const [shelterId, setShelterId] = useState(shelters[0]?.id ?? '');
  const [quantityText, setQuantityText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [quantityError, setQuantityError] = useState(null);
  const quantityRef = useRef(null);

  useEffect(() => {
    let current = true;
    coordinationApi.listStock().then(
      (rows) => {
        if (!current) return;
        setStock(rows);
        // Start on the first organisation and the first type it holds.
        setOrganisationId(rows[0]?.organisation.id ?? '');
        setSupplyType(rows[0]?.supplyType ?? '');
      },
      (failure) => {
        if (current)
          setLoadError(apiErrorMessage(failure, 'The relief stock could not be loaded.'));
      },
    );
    return () => {
      current = false;
    };
  }, []);

  const organisations = organisationsIn(stock ?? []);
  const typesHeld = (stock ?? []).filter((row) => row.organisation.id === organisationId);
  const selected = typesHeld.find((row) => row.supplyType === supplyType);

  const handleOrganisationChange = (event) => {
    const next = event.target.value;
    setOrganisationId(next);
    setSupplyType(stock.find((row) => row.organisation.id === next)?.supplyType ?? '');
    setError(null);
    setQuantityError(null);
  };

  const canSave = Boolean(selected && shelterId && quantityText.trim() !== '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !canSave) return;
    setSubmitting(true);
    setError(null);
    setQuantityError(null);
    try {
      // Sent as typed, not pre-checked here: the server owns the stock rule.
      const result = await coordinationApi.logDistribution({
        shelterId,
        stockId: selected.id,
        quantity: Number(quantityText),
      });
      onLogged(result);
    } catch (failure) {
      const { byField, others } = mapFieldErrors(failure, ['quantity']);
      const fieldMessage = byField.quantity ?? null;
      setQuantityError(fieldMessage);
      // Anything that isn't about the quantity (offline, 403, 409 ...) is a Notice.
      if (others.length > 0) {
        setError(others.join(' '));
      } else if (!fieldMessage) {
        setError(apiErrorMessage(failure, 'The supply could not be logged. Try again.'));
      }
      setSubmitting(false);
      if (fieldMessage) {
        // Show what is held now, and put the cursor back in the field (step 12).
        coordinationApi.listStock().then(setStock, () => {});
        setTimeout(() => quantityRef.current?.focus(), 0);
      }
    }
  };

  let body;
  if (loadError) {
    body = <Notice variant="error">{loadError}</Notice>;
  } else if (!stock) {
    body = <Loader className="my-6" />;
  } else if (stock.length === 0) {
    body = <Notice>No relief stock is held in this district, so there is nothing to log.</Notice>;
  } else {
    body = (
      <>
        <Select
          label="Owner organisation"
          value={organisationId}
          onChange={handleOrganisationChange}
          disabled={submitting}
          options={organisations.map((o) => ({ value: o.id, label: o.name }))}
        />
        <Select
          label="Supply type"
          value={supplyType}
          onChange={(event) => {
            setSupplyType(event.target.value);
            setError(null);
            setQuantityError(null);
          }}
          disabled={submitting}
          options={typesHeld.map((row) => ({
            value: row.supplyType,
            label: supplyTypeLabel(row.supplyType),
          }))}
        />
        <p className="mb-4 text-[13px] font-semibold text-ink" aria-live="polite">
          Available stock{' '}
          <span className="tabular-nums">
            {selected
              ? `${selected.quantityAvailable.toLocaleString('en-US')} ${selected.unit}`
              : '–'}
          </span>
        </p>
        <TextInput
          label={selected ? `Quantity (${selected.unit})` : 'Quantity'}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          ref={quantityRef}
          value={quantityText}
          error={quantityError}
          onChange={(event) => {
            setQuantityText(event.target.value);
            setError(null);
            setQuantityError(null);
          }}
          disabled={submitting}
        />
        <Select
          label="Receiving shelter"
          value={shelterId}
          onChange={(event) => setShelterId(event.target.value)}
          disabled={submitting}
          options={shelters.map((s) => ({ value: s.id, label: s.name }))}
        />
        {error ? <Notice variant="error">{error}</Notice> : null}
      </>
    );
  }

  return (
    <Modal open onClose={onClose} dismissable={!submitting} labelledBy={titleId}>
      <form onSubmit={handleSubmit} noValidate>
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Log Relief Supply
        </h2>

        <div className="mt-4">{body}</div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" fullWidth={false} onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" fullWidth={false} loading={submitting} disabled={!canSave}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
