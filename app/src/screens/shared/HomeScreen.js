import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import useAuth from '../../hooks/useAuth';

// Placeholder landing screen for every signed-in role. Replace it with the
// app's real first screen.
export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Home" />
      <Text className="mt-4 text-[14.5px] text-ink">Signed in as {user?.email}</Text>
      <Text className="mt-1 text-[12.5px] text-muted">Role: {user?.role}</Text>

      <Button className="mt-6" onPress={() => navigation.navigate('AccountSettings')} fullWidth>
        Account settings
      </Button>

      {__DEV__ ? (
        <Button
          className="mt-3"
          variant="outline"
          onPress={() => navigation.navigate('ComponentDemo')}
          fullWidth
        >
          UI kit
        </Button>
      ) : null}
    </Screen>
  );
}
