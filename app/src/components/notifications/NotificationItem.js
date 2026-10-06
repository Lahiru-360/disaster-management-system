import { Pressable, Text, View } from 'react-native';

// How long ago, in words short enough for a list row.
function timeAgo(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

// One inbox row: an unread dot, the title (bold while unread), the message
// and when it arrived. Presentational: what a tap does comes in as onPress.
export default function NotificationItem({ notification, onPress }) {
  const unread = notification.readAt === null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: unread }}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}. ${notification.body}`}
      onPress={() => onPress(notification)}
      className="flex-row gap-3 px-1 py-4 active:bg-haze"
    >
      <View
        className={['mt-1.5 h-2 w-2 rounded-full', unread ? 'bg-ink' : 'bg-transparent'].join(' ')}
      />
      <View className="flex-1">
        <Text
          className={['text-[15px] text-ink', unread ? 'font-semibold' : 'font-medium'].join(' ')}
        >
          {notification.title}
        </Text>
        <Text className="mt-1 text-sm text-muted">{notification.body}</Text>
        <Text className="mt-1.5 text-xs text-muted-dark">{timeAgo(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}
