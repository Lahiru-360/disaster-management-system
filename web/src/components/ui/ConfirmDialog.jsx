import { useId } from 'react';
import Button from './Button';
import Modal from './Modal';

// A Modal pre-shaped as a title + body + Back/confirm action pair, the
// confirmation-step pattern most of the console's destructive or
// hard-to-undo actions share (Nielsen heuristic 5, error prevention).
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  backLabel = 'Back',
  destructive = false,
  loading = false,
  onConfirm,
  onBack,
  dismissable = true,
}) {
  const titleId = useId();

  return (
    <Modal open={open} onClose={onBack} dismissable={dismissable} labelledBy={titleId}>
      <h2 id={titleId} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-2 text-[15px] leading-6 text-muted">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" fullWidth={false} onClick={onBack} disabled={loading}>
          {backLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          fullWidth={false}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
