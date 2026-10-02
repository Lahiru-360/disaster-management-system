import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Placeholder behind the Assignments tab. DMS-142.7 replaces it with the UC03
// §5.2 Rescue Team App screen.
export default function AssignmentsScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Assignments" />
      <EmptyState message="Your team's assignments will appear here." />
    </Screen>
  );
}
