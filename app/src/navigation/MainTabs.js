import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/shared/HomeScreen';
import { TAB_BAR_SCREEN_OPTIONS } from './tabBarTheme';

const Tab = createBottomTabNavigator();

// Ionicons base names; the focused tab uses the filled glyph, the rest the
// `-outline` variant.
const ICONS = {
  Home: 'home',
};

// One tab navigator for every role. When roles need different tabs, read the
// role with useAuth() here, branch on it, and add each tab to ICONS.
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        ...TAB_BAR_SCREEN_OPTIONS,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
    </Tab.Navigator>
  );
}
