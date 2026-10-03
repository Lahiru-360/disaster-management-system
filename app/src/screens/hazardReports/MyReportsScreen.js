import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Placeholder behind the My reports tab. DMS-131.6 replaces it with the list
// of the user's reports and their statuses.
export default function MyReportsScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader title="My reports" />
      <EmptyState message="Your submitted reports will appear here." />
    </Screen>
  );
}
