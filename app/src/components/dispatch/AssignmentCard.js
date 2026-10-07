import { Text, View } from 'react-native';

import { formatKm, haversineKm } from '../../utils/distance';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import CountdownTimer from './CountdownTimer';

const PRIORITY_BADGES = {
  CRITICAL: 'danger',
  HIGH: 'strong',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const priorityLabel = (priority) => priority.charAt(0) + priority.slice(1).toLowerCase();

// What each closed or in-progress status says in the card's title. ASSIGNED
// has its own title, with the countdown.
const STATUS_TITLES = {
  ACKNOWLEDGED: 'Assignment acknowledged',
  ON_SITE: 'On site',
  COMPLETED: 'Assignment completed',
  DECLINED: 'Assignment declined',
  UNRESPONSIVE: 'Assignment expired',
};

// One dispatch in the Assignments tab ("Rescue Team App – Team Alpha", UC03
// §5.2). A new assignment shows a live countdown to its deadline and the
// Acknowledge button; once acknowledged, On site and Completed follow in
// order (Completed only after On site, as the server requires). `team` is the
// lead's team, whose current position gives the distance to the incident.
// Presentational: `busy` disables the buttons while an action is being sent,
// and what each does comes in as a callback. Decline appears only when
// `onDecline` is given.
export default function AssignmentCard({
  dispatch,
  team,
  busy = false,
  onAcknowledge,
  onDecline,
  onOnSite,
  onComplete,
  onExpire,
}) {
  const { status, incidentLocation, priority } = dispatch;
  const closed = !['ASSIGNED', 'ACKNOWLEDGED', 'ON_SITE'].includes(status);
  const distance = team?.currentLocation
    ? ` (${formatKm(haversineKm(team.currentLocation, incidentLocation))})`
    : '';
  const place = `${incidentLocation.label ?? 'Pinned location'}${distance}`;

  return (
    <View
      accessibilityLabel={`${STATUS_TITLES[status] ?? 'New assignment'}. ${place}. Priority ${priorityLabel(priority)}.`}
      className={[
        'my-2 rounded-xl border-[1.5px] p-4',
        status === 'ASSIGNED' ? 'border-signal bg-signal-soft' : 'border-line bg-paper',
        closed && 'opacity-70',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {status === 'ASSIGNED' ? (
        <Text className="text-[15px] font-semibold text-ink">
          New assignment – respond within{' '}
          <CountdownTimer
            deadline={dispatch.ackDeadline}
            onExpire={onExpire}
            className="text-[15px] font-semibold text-signal-ink"
          />
        </Text>
      ) : (
        <Text className="text-[15px] font-semibold text-ink">{STATUS_TITLES[status]}</Text>
      )}

      <Text className="mt-2 text-[15px] text-ink">{place}</Text>
      <View className="mt-2 flex-row items-center gap-2">
        <Text className="text-sm text-muted-dark">Priority:</Text>
        <Badge variant={PRIORITY_BADGES[priority] ?? 'neutral'}>{priorityLabel(priority)}</Badge>
      </View>

      {status === 'ASSIGNED' ? (
        <View className="mt-4 flex-row gap-3">
          <Button
            fullWidth={false}
            className="flex-1"
            loading={busy}
            onPress={() => onAcknowledge(dispatch)}
          >
            Acknowledge
          </Button>
          {onDecline ? (
            <Button
              variant="outline"
              fullWidth={false}
              className="flex-1"
              disabled={busy}
              onPress={() => onDecline(dispatch)}
            >
              Decline
            </Button>
          ) : null}
        </View>
      ) : null}

      {status === 'ACKNOWLEDGED' || status === 'ON_SITE' ? (
        <View className="mt-4 flex-row gap-3">
          <Button
            variant={status === 'ACKNOWLEDGED' ? 'primary' : 'outline'}
            fullWidth={false}
            className="flex-1"
            loading={busy && status === 'ACKNOWLEDGED'}
            disabled={status !== 'ACKNOWLEDGED' || busy}
            onPress={() => onOnSite(dispatch)}
          >
            On site
          </Button>
          <Button
            variant={status === 'ON_SITE' ? 'primary' : 'outline'}
            fullWidth={false}
            className="flex-1"
            loading={busy && status === 'ON_SITE'}
            disabled={status !== 'ON_SITE' || busy}
            onPress={() => onComplete(dispatch)}
          >
            Completed
          </Button>
        </View>
      ) : null}
    </View>
  );
}
