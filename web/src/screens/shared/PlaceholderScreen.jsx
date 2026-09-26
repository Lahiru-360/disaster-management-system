import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

// Stands in for every console page until it's built (see ConsoleRoutes.jsx).
export default function PlaceholderScreen({ title }) {
  return (
    <Screen>
      <ScreenHeader title={title} />
      <Card className="mt-6 border-dashed">
        <p className="text-sm text-muted">This page hasn&apos;t been built yet.</p>
      </Card>
    </Screen>
  );
}
