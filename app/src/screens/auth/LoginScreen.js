import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Notice from '../../components/ui/Notice';
import SectionLabel from '../../components/ui/SectionLabel';
import TextInput from '../../components/ui/TextInput';
import { DEMO_PASSWORD, DEMO_USERS } from '../../constants/demoUsers';
import { isMobileRole } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// Only the field roles - officer accounts sign in on the web portal, and this
// app would only show them the wrong-platform screen.
const MOBILE_DEMO_USERS = DEMO_USERS.filter(({ role }) => isMobileRole(role));

export default function LoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ResetPasswordScreen navigates here with this param to hand off
  // its confirmation - the API issues no tokens, so this is the only trace
  // of the reset reaching Login. Latched into state the same way
  // AccountSettingsScreen does for passwordChanged, so the notice survives
  // the effect below clearing the param instead of flashing and vanishing.
  const [passwordResetNotice, setPasswordResetNotice] = useState(false);
  const [seenPasswordResetParam, setSeenPasswordResetParam] = useState(route.params?.passwordReset);
  if (route.params?.passwordReset !== seenPasswordResetParam) {
    setSeenPasswordResetParam(route.params?.passwordReset);
    if (route.params?.passwordReset) {
      setPasswordResetNotice(true);
    }
  }

  useEffect(() => {
    if (route.params?.passwordReset) {
      navigation.setParams({ passwordReset: undefined });
    }
  }, [route.params?.passwordReset, navigation]);

  const signIn = async (credentials) => {
    setFormError('');
    setSubmitting(true);
    try {
      await login(credentials);
    } catch (error) {
      const apiError = error.response?.data?.error;
      setFormError(apiError?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => signIn({ email: email.trim().toLowerCase(), password });

  const handleDemoSignIn = (demoUser) => signIn({ email: demoUser.email, password: DEMO_PASSWORD });

  return (
    <AuthShell
      scroll
      header={
        <>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">Log in</Text>
          <Text className="mt-3 text-lede text-muted-dark">
            Welcome back. Pick up where you left off.
          </Text>
        </>
      }
    >
      {passwordResetNotice ? (
        <Notice className="mb-4">Your password was reset. Log in with your new password.</Notice>
      ) : null}

      <TextInput
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        disabled={submitting}
      />

      <TextInput
        label="Password"
        placeholder="Password"
        secureTextEntry={!showPassword}
        value={password}
        onChangeText={setPassword}
        containerClassName="mb-0"
        disabled={submitting}
      />
      <View className="mb-7 mt-3 flex-row items-center justify-between">
        <Pressable onPress={() => navigation.navigate('ForgotPassword')} disabled={submitting}>
          <Text className="text-[13px] font-semibold text-signal">Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => setShowPassword((prev) => !prev)} disabled={submitting}>
          <Text className="text-[13px] font-semibold text-ink">
            {showPassword ? 'Hide password' : 'Show password'}
          </Text>
        </Pressable>
      </View>

      {formError ? (
        <Notice variant="error" className="mb-4">
          {formError}
        </Notice>
      ) : null}

      <Button fullWidth trailingArrow onPress={handleSubmit} loading={submitting}>
        Log In
      </Button>

      <SectionLabel className="mt-8">Demo accounts</SectionLabel>
      <Text className="mt-1 text-[12.5px] text-muted">Tap an account to log in as it.</Text>
      <View className="mt-3 gap-3">
        {MOBILE_DEMO_USERS.map((demoUser) => (
          <Card
            key={demoUser.email}
            onPress={submitting ? undefined : () => handleDemoSignIn(demoUser)}
            className="flex-row items-center justify-between py-4"
          >
            <View className="flex-1">
              <Text className="font-display text-title text-ink">{demoUser.label}</Text>
              <Text className="mt-[5px] text-desc text-muted">{demoUser.email}</Text>
            </View>
            <Text className="text-[17px] font-semibold text-muted-dark">›</Text>
          </Card>
        ))}
      </View>

      <View className="flex-1" />

      <Pressable
        onPress={() => navigation.navigate('RoleSelect')}
        className="py-6"
        disabled={submitting}
      >
        <Text className="text-center text-[14.5px] text-muted">
          Don&apos;t have an account? <Text className="font-semibold text-signal">Sign up</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
