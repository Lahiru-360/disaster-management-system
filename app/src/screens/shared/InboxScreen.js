import { useNavigation } from '@react-navigation/native';
import { FlatList, RefreshControl, View } from 'react-native';

import AlertCard from '../../components/alerts/AlertCard';
import NotificationItem from '../../components/notifications/NotificationItem';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { tabsForRole } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import useInbox from '../../hooks/useInbox';
import { tabForLink } from '../../utils/notificationLinks';

// The Inbox tab, for every field role: the user's notifications, newest first,
// unread ones marked. Pull down to refresh; scroll to the end for older ones.
// Tapping an item marks it read and opens the tab its link points to (e.g. My
// reports or Assignments), when this user has that tab. Hazard warnings
// (HAZARD_ALERT) show as alert cards coloured by severity.
export default function InboxScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const inbox = useInbox();

  const handlePress = (item) => {
    inbox.markRead(item.id);
    const tab = tabForLink(item.link);
    if (tab && tabsForRole(user?.role).includes(tab)) {
      navigation.navigate(tab);
    }
  };

  if (inbox.loading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Inbox" />
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Inbox" />
      {inbox.error ? (
        <Notice variant="error" className="mb-3">
          Couldn&apos;t update your inbox. Pull down to try again.
        </Notice>
      ) : null}
      <FlatList
        data={inbox.notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.type === 'HAZARD_ALERT' ? (
            <AlertCard notification={item} onPress={handlePress} />
          ) : (
            <NotificationItem notification={item} onPress={handlePress} />
          )
        }
        ItemSeparatorComponent={() => <View className="h-px bg-line" />}
        ListEmptyComponent={
          inbox.error ? null : (
            <EmptyState message="No notifications yet. Updates about your reports will appear here." />
          )
        }
        ListFooterComponent={inbox.loadingMore ? <Loader size="small" /> : null}
        onEndReached={inbox.loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={inbox.refreshing} onRefresh={inbox.refresh} />}
        contentContainerClassName="flex-grow"
      />
    </Screen>
  );
}
