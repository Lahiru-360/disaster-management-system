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

const ROLES = [
  {
    role: 'seeker',
    title: "I'm looking for work",
    description: 'Browse gigs, apply, and get hired by businesses near you.',
  },
  {
    role: 'business',
    title: "I'm hiring",
    description: 'Post gigs and find people to get the work done.',
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
        {ROLES.map(({ role, title, description }) => (
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
        {APP_NAME}.
      </Notice>

      <View className="flex-1" />

      <Button trailingArrow onPress={handleNext} disabled={!selectedRole} fullWidth>
        Next
      </Button>

      <View className="mb-6" />
    </AuthShell>
  );
}
