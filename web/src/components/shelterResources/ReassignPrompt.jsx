import Button from '../ui/Button';
import Notice from '../ui/Notice';

// What the banner says for a dispatch that needs another team, in the
// contract's words (§13.12): the lead declined it (A3.2), or never answered
// before the deadline (E4.2).
function message(dispatch) {
  const team = dispatch.team?.name ?? 'The team';
  if (dispatch.status === 'UNRESPONSIVE') return `No response from ${team} – reassign`;
  return `${team} declined (${dispatch.declineReason ?? 'no reason given'}) – choose another team`;
}

// UC03 A3.2 and E4.2: a team declined its assignment or never answered it, so
// the officer is asked to choose another. One banner per such dispatch:
// "Choose another team" opens the Dispatch dialog for the same incident (the
// flow resumes at step 7), and Dismiss leaves it. Presentational: what each
// does comes in as a callback.
export default function ReassignPrompt({ dispatches, onReassign, onDismiss }) {
  if (dispatches.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {dispatches.map((dispatch) => (
        <div key={dispatch.id} className="flex flex-wrap items-center gap-3">
          <Notice className="min-w-0 flex-1">{message(dispatch)}</Notice>
          <div className="flex gap-2">
            <Button fullWidth={false} onClick={() => onReassign(dispatch)}>
              Choose another team
            </Button>
            <Button variant="outline" fullWidth={false} onClick={() => onDismiss(dispatch)}>
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
