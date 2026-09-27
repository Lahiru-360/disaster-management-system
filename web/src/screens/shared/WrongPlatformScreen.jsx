import { useState } from 'react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { isMobileRole, roleLabel } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// What a signed-in user sees instead of the console when their role doesn't
// use it: a field role (whose accounts use the mobile app) or a role this
// portal doesn't know. The session is left open so they see why they stopped
// here rather than being bounced back to Login; logging out is the way on.
// The mirror image of app/src/screens/shared/WrongPlatformScreen.js.
export default function WrongPlatformScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const isFieldRole = isMobileRole(user?.role);

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
    <div className="flex min-h-screen items-center justify-center bg-haze px-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-[26px] font-bold tracking-[-0.03em] text-ink">
          {isFieldRole ? 'Use the mobile app' : 'Account not supported'}
        </h1>
        <p className="mt-3 text-[14.5px] text-ink">
          {isFieldRole
            ? `Field accounts use the mobile app. Your ${roleLabel(user.role)} account can't be used in the web portal.`
            : "This account's role isn't supported by the web portal."}
        </p>
        <p className="mt-4 text-[12.5px] text-muted">
          Signed in as {user?.name} · {user?.email}
        </p>

        <Button className="mt-8" onClick={handleLogout} loading={loggingOut}>
          Log out
        </Button>
      </Card>
    </div>
  );
}
