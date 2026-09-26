import { useState } from 'react';
import { Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';
import { PLATFORMS, roleLabel, rolePlatform } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// What a signed-in user sees instead of the app when their role doesn't use
// it: an officer (whose accounts use the web portal) or a role this app
// doesn't know. The session is left open so they see why they stopped here
// rather than being bounced back to Login; logging out is the way on.
export default function WrongPlatformScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const isOfficer = rolePlatform(user?.role) === PLATFORMS.WEB;

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // logout() ends the local session even when the API call fails, which
      // unmounts this screen - there's nothing left to recover here.
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Text className="font-display text-[26px] text-ink">
          {isOfficer ? 'Use the web portal' : 'Account not supported'}
        </Text>
        <Text className="mt-3 text-[14.5px] text-ink">
          {isOfficer
            ? `Officer accounts use the web portal. Your ${roleLabel(user.role)} account can't be used in the mobile app.`
            : "This account's role isn't supported by the mobile app."}
        </Text>
        <Text className="mt-4 text-[12.5px] text-muted">
          Signed in as {user?.name} · {user?.email}
        </Text>

        <Button className="mt-8" onPress={handleLogout} loading={loggingOut} fullWidth>
          Log out
        </Button>
      </View>
    </Screen>
  );
}
