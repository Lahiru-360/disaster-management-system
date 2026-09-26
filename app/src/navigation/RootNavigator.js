import { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import Loader from '../components/ui/Loader';
import ComponentDemoScreen from '../screens/dev/ComponentDemoScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';
import ChangePasswordScreen from '../screens/shared/ChangePasswordScreen';
import useAuth from '../hooks/useAuth';
import { AUTH_STATUS } from '../store/AuthContext';

const Stack = createNativeStackNavigator();

// Screens pushed on top of the tabs are registered here once for every role.
// Role-specific screens go in a branch on useAuth().user.role, the same way
// MainTabs would branch its tabs.
function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />

      {__DEV__ ? (
        <Stack.Screen
          name="ComponentDemo"
          component={ComponentDemoScreen}
          options={{ headerShown: true, title: 'UI Kit' }}
        />
      ) : null}
    </Stack.Navigator>
  );
}

// Auth and app stacks are alternatives, not destinations you navigate to -
// only one is ever mounted, so there's no back/swipe path from one into the other.
export default function RootNavigator() {
  const { status } = useAuth();

  // A brand-new install should land on RoleSelect (choose a role, sign up) -
  // but anyone who signs out after having been authenticated already has an
  // account, so they belong on Login instead. Adjusted during render rather
  // than in an effect, per React's own pattern for deriving state from a
  // prior render's value - it only ever flips false → true, guarded so it
  // can't loop.
  const [prevStatus, setPrevStatus] = useState(status);
  const [wasAuthenticated, setWasAuthenticated] = useState(status === AUTH_STATUS.AUTHENTICATED);

  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === AUTH_STATUS.AUTHENTICATED) {
      setWasAuthenticated(true);
    }
  }

  if (status === AUTH_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
    return <AppStack />;
  }

  return <AuthStack initialRouteName={wasAuthenticated ? 'Login' : 'RoleSelect'} />;
}
