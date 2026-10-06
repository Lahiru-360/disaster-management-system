import { useState } from 'react';

import { DISMISSAL_NOTE_MAX_LENGTH, DISMISSAL_REASONS } from '../../constants/hazardReports';
import Button from '../ui/Button';
import Select from '../ui/Select';
import TextArea from '../ui/TextArea';

// UC02 A1.1, as the §5.2 wireframe draws it: "Dismiss reason: [Inaccurate ▾]"
// (required) and "Note: optional note" (up to 200 characters), then Confirm
// dismissal. Presentational: `onSubmit({ reason, note })` does the call.
export default function DismissForm({ submitting = false, onSubmit, onCancel }) {
  const [reason, setReason] = useState(DISMISSAL_REASONS[0].value);
  const [note, setNote] = useState('');

  function submit(event) {
    event.preventDefault();
    onSubmit({ reason, note: note.trim() || undefined });
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-haze p-4">
      <Select
        label="Dismiss reason"
        options={DISMISSAL_REASONS}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={submitting}
        required
      />
      <TextArea
        label="Note"
        placeholder="Optional note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={DISMISSAL_NOTE_MAX_LENGTH}
        rows={3}
        disabled={submitting}
      />
      <div className="flex gap-3">
        <Button type="submit" variant="danger" fullWidth={false} loading={submitting}>
          Confirm dismissal
        </Button>
        <Button variant="outline" fullWidth={false} onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
