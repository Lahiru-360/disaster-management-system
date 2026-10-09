import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import AssignmentsScreen from '../screens/dispatch/AssignmentsScreen';
import MyReportsScreen from '../screens/hazardReports/MyReportsScreen';
import ReportHazardScreen from '../screens/hazardReports/ReportHazardScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';
import HomeScreen from '../screens/shared/HomeScreen';
import InboxScreen from '../screens/shared/InboxScreen';
import { TAB_LABELS, TABS, tabsForRole } from '../constants/roles';
import useAuth from '../hooks/useAuth';
import { TAB_BAR_SCREEN_OPTIONS } from './tabBarTheme';

const Tab = createBottomTabNavigator();

// Ionicons base names; the focused tab uses the filled glyph, the rest the
// `-outline` variant.
const ICONS = {
  [TABS.HOME]: 'home',
  [TABS.REPORT]: 'megaphone',
  [TABS.MY_REPORTS]: 'document-text',
  [TABS.ASSIGNMENTS]: 'clipboard',
  [TABS.INBOX]: 'notifications',
  [TABS.ACCOUNT]: 'person-circle',
};

// The screen behind each tab. A tab with no entry here is left out of the bar,
// so adding a tab's screen is one line.
const SCREENS = {
  [TABS.HOME]: HomeScreen,
  [TABS.REPORT]: ReportHazardScreen,
  [TABS.MY_REPORTS]: MyReportsScreen,
  [TABS.ASSIGNMENTS]: AssignmentsScreen,
  [TABS.INBOX]: InboxScreen,
  [TABS.ACCOUNT]: AccountSettingsScreen,
};

// One tab navigator for every field role. Which tabs a role sees, and in what
// order, comes from tabsForRole() in constants/roles.js, not from branches here.
export default function MainTabs() {
  const { user } = useAuth();
  const tabs = tabsForRole(user?.role).filter((name) => SCREENS[name]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        ...TAB_BAR_SCREEN_OPTIONS,
        tabBarLabel: TAB_LABELS[route.name],
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`}
            size={size}
            color={color}
          />
        ),
      })}
    >
      {tabs.map((name) => (
        <Tab.Screen key={name} name={name} component={SCREENS[name]} />
      ))}
    </Tab.Navigator>
  );
}
