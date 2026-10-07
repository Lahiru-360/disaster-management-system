import Button from '../ui/Button';
import Notice from '../ui/Notice';

// UC03 A3.2: a team declined its assignment, so the officer is asked to
// choose another. One banner per declined dispatch, in the contract's words
// ("Team Alpha declined (Vehicle unavailable) – choose another team"):
// "Choose another team" opens the Dispatch dialog for the same incident, and
// Dismiss leaves it. Presentational: what each does comes in as a callback.
export default function ReassignPrompt({ dispatches, onReassign, onDismiss }) {
  if (dispatches.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {dispatches.map((dispatch) => (
        <div key={dispatch.id} className="flex flex-wrap items-center gap-3">
          <Notice className="min-w-0 flex-1">
            {dispatch.team?.name ?? 'The team'} declined (
            {dispatch.declineReason ?? 'no reason given'}) – choose another team
          </Notice>
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
