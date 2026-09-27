import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Notice from '../../components/ui/Notice';
import ProgressPips from '../../components/ui/ProgressPips';
import { APP_NAME } from '../../constants/config';
import { ROLES } from '../../constants/roles';

// One card per self-sign-up role (SELF_SIGN_UP_ROLES) - every other role's
// account is created for it by the seed script.
const ROLE_OPTIONS = [
  {
    role: ROLES.CITIZEN,
    title: "I'm a member of the public",
    description: 'Report hazards near you and get warnings for your area.',
  },
  {
    role: ROLES.COMMUNITY_VOLUNTEER,
    title: "I'm a community volunteer",
    description: 'Report hazards and get warnings as a trained volunteer.',
  },
];

export default function RoleSelectScreen() {
  const navigation = useNavigation();
  const [selectedRole, setSelectedRole] = useState(null);

  const handleNext = () => {
    if (!selectedRole) return;
    navigation.navigate('SignUp', { role: selectedRole });
  };

  return (
    <AuthShell
      header={
        <>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">
            Join{`\n`}
            {APP_NAME}
          </Text>
        </>
      }
    >
      <ProgressPips total={2} current={1} caption />

      <Text className="mt-5 text-lede text-muted">
        Choose how you&apos;ll use the app. You can&apos;t change this later.
      </Text>

      <View className="mt-6 gap-3">
        {ROLE_OPTIONS.map(({ role, title, description }) => (
          <Card
            key={role}
            title={title}
            description={description}
            selected={selectedRole === role}
            onPress={() => setSelectedRole(role)}
          />
        ))}
      </View>

      <Notice className="mt-5">
        This sets up your whole account, so pick the one that fits how you&apos;ll mostly use{' '}
        {APP_NAME}. Rescue team leads and officers don&apos;t sign up here - their accounts are
        created for them.
      </Notice>

      <View className="flex-1" />

      <Button trailingArrow onPress={handleNext} disabled={!selectedRole} fullWidth>
        Next
      </Button>

      <View className="mb-6" />
    </AuthShell>
  );
}
