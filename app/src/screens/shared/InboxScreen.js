import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Placeholder behind the Inbox tab, shown to every field role. DMS-106.6
// replaces it with the notification list.
export default function InboxScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Inbox" />
      <EmptyState message="Your notifications will appear here." />
    </Screen>
  );
}
