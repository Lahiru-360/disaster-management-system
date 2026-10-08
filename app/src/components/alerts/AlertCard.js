import { Pressable, Text, View } from 'react-native';

import { formatRelativeTime } from '../../utils/format';
import Badge from '../ui/Badge';

// Each SeverityLevel's tone: the card's tint and edge, and its Badge variant.
const SEVERITY_TONES = {
  SEVERE: { card: 'border-danger bg-danger-soft', badge: 'danger' },
  HIGH: { card: 'border-caution bg-caution-soft', badge: 'caution' },
  MEDIUM: { card: 'border-warning-ink bg-warning-soft', badge: 'warning' },
  LOW: { card: 'border-line bg-haze', badge: 'neutral' },
};

// A UC01 hazard warning in the Inbox (a HAZARD_ALERT item, DMS-121): the
// severity, the title and what to do, coloured by severity. It stands in for
// the mocked push, SMS and audible delivery. Presentational: what a tap does
// comes in as onPress.
export default function AlertCard({ notification, onPress }) {
  const unread = notification.readAt === null;
  const tone = SEVERITY_TONES[notification.severity] ?? SEVERITY_TONES.LOW;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: unread }}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.severity ?? ''} hazard warning. ${notification.title}. ${notification.body}`}
      onPress={() => onPress(notification)}
      className={['my-2 rounded-xl border-l-4 px-4 py-3.5 active:opacity-80', tone.card].join(' ')}
    >
      <View className="flex-row items-center gap-2">
        <Badge variant={tone.badge}>{notification.severity ?? 'ALERT'}</Badge>
        <Text className="flex-1 text-xs text-muted-dark">
          {formatRelativeTime(notification.createdAt)}
        </Text>
        {unread ? <View className="h-2 w-2 rounded-full bg-ink" /> : null}
      </View>
      <Text
        className={['mt-2 text-[15px] text-ink', unread ? 'font-semibold' : 'font-medium'].join(
          ' ',
        )}
      >
        {notification.title}
      </Text>
      <Text className="mt-1 text-sm text-ink">{notification.body}</Text>
    </Pressable>
  );
}
