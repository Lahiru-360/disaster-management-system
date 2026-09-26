import { useState } from 'react';

import AuthShell from '../../components/ui/AuthShell';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Notice from '../../components/ui/Notice';
import SectionLabel from '../../components/ui/SectionLabel';
import TextInput from '../../components/ui/TextInput';
import { DEMO_PASSWORD, DEMO_USERS } from '../../constants/demoUsers';
import { isWebRole } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// Only the officer roles - field-role accounts sign in on the mobile app, and
// this portal would only show them the wrong-platform screen.
const WEB_DEMO_USERS = DEMO_USERS.filter(({ role }) => isWebRole(role));

// Signing in flips AuthContext's status, which makes RootNavigator swap these
// routes for the console's, so nothing here navigates on success.
export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    signIn({ email: email.trim().toLowerCase(), password });
  };

  const handleDemoSignIn = (demoUser) => signIn({ email: demoUser.email, password: DEMO_PASSWORD });

  return (
    <AuthShell
      header={
        <>
          <Brand />
          <h1 className="mt-8 text-[42px] leading-none font-bold tracking-[-0.04em] text-paper">
            Log in
          </h1>
          <p className="mt-3 text-[15px] leading-normal text-muted-dark">
            Officer access to the Disaster Management Centre console.
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />

        <TextInput
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          containerClassName="mb-0"
          disabled={submitting}
        />
        <div className="mt-3 mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={submitting}
            className="cursor-pointer text-[13px] font-semibold text-ink hover:underline"
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
        </div>

        {formError ? (
          <Notice variant="error" className="mb-4">
            {formError}
          </Notice>
        ) : null}

        <Button type="submit" loading={submitting}>
          Log in
        </Button>
      </form>

      <SectionLabel className="mt-10">Demo accounts</SectionLabel>
      <p className="mt-1 text-[12.5px] text-muted">Click an account to log in as it.</p>
      <div className="mt-3 flex flex-col gap-3">
        {WEB_DEMO_USERS.map((demoUser) => (
          <Card
            key={demoUser.email}
            onClick={() => handleDemoSignIn(demoUser)}
            disabled={submitting}
            className="flex items-center justify-between py-4"
          >
            <span>
              <span className="block text-[17px] font-bold tracking-[-0.02em] text-ink">
                {demoUser.label}
              </span>
              <span className="mt-1 block text-sm text-muted">{demoUser.email}</span>
            </span>
            <span aria-hidden="true" className="text-[17px] font-semibold text-muted">
              ›
            </span>
          </Card>
        ))}
      </div>
    </AuthShell>
  );
}
