import { Navigate, Route, Routes, useLocation } from 'react-router';

import ConsoleLayout from './ConsoleLayout';
import GroundReportsScreen from '../screens/groundReports/GroundReportsScreen';
import HazardWarningsScreen from '../screens/hazardWarnings/HazardWarningsScreen';
import DeliverySummaryScreen from '../screens/hazardWarnings/DeliverySummaryScreen';
import IssueWarningScreen from '../screens/hazardWarnings/IssueWarningScreen';
import PlaceholderScreen from '../screens/shared/PlaceholderScreen';
import ShelterResourcesScreen from '../screens/shelterResources/ShelterResourcesScreen';

// Where a fresh sign-in lands: the page the officer asked for before being
// sent to /login (see AuthRoutes), or the dashboard.
function RedirectAfterLogin() {
  const from = useLocation().state?.from;
  const to = from ? `${from.pathname}${from.search}${from.hash}` : '/';
  return <Navigate to={to} replace />;
}

// The signed-in officer routes: every page renders inside ConsoleLayout (top
// bar + sidebar). The web counterpart of the AppStack in
// app/src/navigation/RootNavigator.js together with MainTabs.js. Each path
// here must match a `to` in sidebarItems.js. Every page is a placeholder for
// now; building one means replacing its PlaceholderScreen with the real
// screen.
export default function ConsoleRoutes() {
  return (
    <Routes>
      <Route element={<ConsoleLayout />}>
        <Route index element={<PlaceholderScreen title="Dashboard" />} />
        <Route path="hazard-warnings" element={<HazardWarningsScreen />} />
        <Route path="hazard-warnings/new" element={<IssueWarningScreen key="new" />} />
        <Route path="hazard-warnings/:id" element={<DeliverySummaryScreen />} />
        <Route path="hazard-warnings/:id/edit" element={<IssueWarningScreen key="edit" />} />
        <Route path="ground-reports" element={<GroundReportsScreen />} />
        <Route path="shelter-resources" element={<ShelterResourcesScreen />} />
        <Route path="rescue-teams" element={<PlaceholderScreen title="Rescue Teams" />} />
        <Route path="relief-supplies" element={<PlaceholderScreen title="Relief Supplies" />} />
        <Route path="map" element={<PlaceholderScreen title="Map" />} />
        <Route path="reports" element={<PlaceholderScreen title="Reports" />} />
        <Route path="settings" element={<PlaceholderScreen title="Settings" />} />
      </Route>

      <Route path="/login" element={<RedirectAfterLogin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
