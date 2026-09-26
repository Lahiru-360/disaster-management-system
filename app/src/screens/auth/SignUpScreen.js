import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import ProgressPips from '../../components/ui/ProgressPips';
import RoleStrip from '../../components/ui/RoleStrip';
import TextInput from '../../components/ui/TextInput';
import useAuth from '../../hooks/useAuth';
import { validateSignUpForm } from '../../utils/validation';

const ROLE_LABELS = {
  seeker: 'Seeker',
  business: 'Business',
};

export default function SignUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { register } = useAuth();

  const [role] = useState(route.params?.role);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validationErrors = validateSignUpForm({ email, password, confirmPassword });
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        role,
      });
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: apiError.message });
      } else if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach(({ field, message }) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
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
          <Text className="mt-8 font-display text-h1 text-paper">Create your{`\n`}account</Text>
        </>
      }
    >
      <ProgressPips total={2} current={2} caption />

      <RoleStrip
        className="mt-5"
        value={ROLE_LABELS[role]}
        onAction={submitting ? undefined : () => navigation.navigate('RoleSelect')}
      />

      <TextInput
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        disabled={submitting}
        containerClassName="mt-6"
      />
      <TextInput
        label="Password"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        disabled={submitting}
      />
      <TextInput
        label="Confirm password"
        placeholder="Confirm password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        disabled={submitting}
        containerClassName="mb-7"
      />

      {formError ? (
        <Notice variant="error" className="mb-4">
          {formError}
        </Notice>
      ) : null}

      <Button trailingArrow onPress={handleSubmit} fullWidth loading={submitting}>
        Sign Up
      </Button>

      <View className="flex-1" />

      <Pressable
        onPress={() => navigation.navigate('Login')}
        className="py-6"
        disabled={submitting}
      >
        <Text className="text-center text-[14.5px] text-muted">
          Already have an account? <Text className="font-semibold text-signal">Log in</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}
