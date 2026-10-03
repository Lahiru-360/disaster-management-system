import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import PasswordStrengthMeter from '../../components/ui/PasswordStrengthMeter';
import ScreenHeader from '../../components/ui/ScreenHeader';
import TextInput from '../../components/ui/TextInput';
import { TABS } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { isValidPassword } from '../../utils/validation';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && isValidPassword(newPassword) && confirmPassword === newPassword;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      // Pops back to the already-mounted Account screen that pushed this one
      // (the Account tab inside Main, or the AccountSettings page) and hands
      // it the confirmation to render, rather than a plain goBack() that
      // would say nothing. popTo, because navigate() in React Navigation 7
      // pushes a second copy instead of going back.
      if (route.params?.returnTo === TABS.ACCOUNT) {
        navigation.popTo('Main', { screen: TABS.ACCOUNT, params: { passwordChanged: true } });
      } else {
        navigation.popTo('AccountSettings', { passwordChanged: true });
      }
    } catch (error) {
      const apiError = error.response?.data?.error;
      // Only a wrong current password gets field-level treatment and
      // only that field is cleared - new/confirm survive every
      // failure so a mistyped old password never costs the new one too.
      if (apiError?.code === 'INVALID_CURRENT_PASSWORD') {
        setErrors({ currentPassword: apiError.message });
        setCurrentPassword('');
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title="Change password"
        small
        onBack={submitting ? undefined : () => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[22px] pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Current password"
          placeholder="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          error={errors.currentPassword}
          disabled={submitting}
        />

        <TextInput
          label="New password"
          placeholder="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          disabled={submitting}
          containerClassName="mb-1"
        />
        <PasswordStrengthMeter password={newPassword} />

        <TextInput
          label="Confirm new password"
          placeholder="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          disabled={submitting}
        />

        <Notice>Saving this signs you out of every other device automatically.</Notice>

        {formError ? (
          <Notice variant="error" className="mt-4">
            {formError}
          </Notice>
        ) : null}
      </ScrollView>

      <View className="border-t border-line px-[22px] pb-3 pt-3">
        <Button onPress={handleSubmit} loading={submitting} disabled={!canSubmit}>
          Update password
        </Button>
      </View>
    </SafeAreaView>
  );
}
