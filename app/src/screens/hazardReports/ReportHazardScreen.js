import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Placeholder behind the Report tab. DMS-130.9 replaces it with the UC02 §5.1
// report form.
export default function ReportHazardScreen() {
  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Report a Hazard" />
      <EmptyState message="Hazard reporting is coming soon." />
    </Screen>
  );
}
