import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import TextInput from '../../components/ui/TextInput';
import useAuth from '../../hooks/useAuth';
import { isValidEmail } from '../../utils/validation';

// The confirmation is neutral by construction: the API always returns the same
// body regardless of whether the address exists (docs/api-contract.md §5.9),
// so success here never branches on anything. A genuine request failure
// (network/server, not "no such account") still gets its own formError,
// the same way LoginScreen/SignUpScreen surface theirs.
export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const canSubmit = isValidEmail(email);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setFormError('');
    setSubmitting(true);
    try {
      await requestPasswordReset({ email: email.trim().toLowerCase() });
      setSent(true);
    } catch (error) {
      const apiError = error.response?.data?.error;
      setFormError(apiError?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      scroll
      header={
        <>
          <Pressable onPress={() => navigation.goBack()} className="mb-5 -ml-1 self-start p-1">
            <Text className="text-[22px] font-semibold text-paper">‹</Text>
          </Pressable>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">Forgot password</Text>
          <Text className="mt-3 text-lede text-muted-dark">
            Enter the email you signed up with and we&apos;ll send you a link to reset your
            password.
          </Text>
        </>
      }
    >
      {sent ? (
        <>
          <Notice className="mt-2">
            If that email is registered, a password reset link has been sent.
          </Notice>

          <View className="flex-1" />
        </>
      ) : (
        <>
          <TextInput
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            disabled={submitting}
          />

          <Button
            fullWidth
            trailingArrow
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            Send reset link
          </Button>

          <Text className="mt-4 text-[13px] font-medium text-muted">
            The link works once and expires after 30 minutes.
          </Text>

          {formError ? (
            <Notice variant="error" className="mt-4">
              {formError}
            </Notice>
          ) : null}

          <View className="flex-1" />
        </>
      )}

      <Pressable
        onPress={() => navigation.navigate('Login')}
        className="py-6"
        disabled={submitting}
      >
        <Text className="text-center text-[14.5px] text-muted">
          Remembered it? <Text className="font-semibold text-signal">Log in</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
