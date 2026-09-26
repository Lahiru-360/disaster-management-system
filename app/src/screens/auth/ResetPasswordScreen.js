import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter';
import TextInput from '../../components/ui/TextInput';
import useAuth from '../../hooks/useAuth';
import { isValidPassword } from '../../utils/validation';

// No back control: arriving from an emailed link means there's no previous
// screen in the stack, so AuthShell's header carries no back affordance
// here, unlike ForgotPasswordScreen's.
export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { resetPassword } = useAuth();
  // The token does not carry an email, and the API must not return one
  // before the reset succeeds - that would make the token an address-lookup
  // oracle. `email` is only ever what an
  // in-app continuous flow passed through; there is no endpoint to fetch it.
  const { token, email } = route.params ?? {};

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [tokenError, setTokenError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Caught on the client, with a field-level error, before any request is
  // made - only shown once there's something to mismatch against,
  // so the field doesn't start in an error state.
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit = isValidPassword(newPassword) && confirmPassword.length > 0 && !confirmMismatch;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setErrors({});
    setTokenError('');
    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      // The API issues no tokens - the user is not signed in automatically,
      // so this hands Login a confirmation to render rather than any session.
      navigation.navigate('Login', { passwordReset: true });
    } catch (error) {
      const apiError = error.response?.data?.error;
      // No field is at fault when the link itself is the problem, so the
      // token refusal is a screen-level notice, not a field error.
      if (apiError?.code === 'RESET_TOKEN_INVALID') {
        setTokenError(apiError.message);
      } else if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach(({ field, message }) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
      } else {
        setTokenError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      scroll
      header={
        <>
          <Brand />
          <Text className="mt-8 font-display text-h1 text-paper">Set a new password</Text>
        </>
      }
    >
      <View className="rounded-ds-md bg-signal-soft px-[14px] py-[11px]">
        <Text className="text-[12.5px] font-semibold text-signal-ink">
          {email ? `Resetting the password for ${email}` : 'Resetting your password'}
        </Text>
      </View>

      <TextInput
        label="New password"
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        error={errors.newPassword}
        disabled={submitting}
        containerClassName="mb-1 mt-5"
      />
      <PasswordStrengthMeter password={newPassword} />

      <TextInput
        label="Confirm new password"
        placeholder="Confirm new password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={confirmMismatch ? 'Passwords do not match.' : undefined}
        disabled={submitting}
      />

      <Notice>Setting a new password signs you out on every device.</Notice>

      {tokenError ? (
        <>
          <Notice variant="error" className="mt-4">
            {tokenError}
          </Notice>
          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            className="mt-3 self-start"
          >
            <Text className="text-[13px] font-semibold text-signal">Request a new link</Text>
          </Pressable>
        </>
      ) : null}

      <View className="flex-1" />

      <Button
        fullWidth
        trailingArrow
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      >
        Reset password
      </Button>
    </AuthShell>
  );
}
