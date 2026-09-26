import AuthRoutes from './AuthRoutes';
import ConsoleRoutes from './ConsoleRoutes';
import Loader from '../components/ui/Loader';
import WrongPlatformScreen from '../screens/shared/WrongPlatformScreen';
import { isWebRole } from '../constants/roles';
import useAuth from '../hooks/useAuth';
import { AUTH_STATUS } from '../store/AuthContext';

// The auth and console routes are alternatives, not destinations you navigate
// to - only one set is ever mounted, so a signed-out visitor can't reach a
// console URL and a signed-in officer never sees the login page. The same
// conditional render as app/src/navigation/RootNavigator.js, with React Router
// route sets in place of React Navigation stacks.
export default function RootNavigator() {
  const { status, user } = useAuth();

  // Nothing routes until /auth/me has answered, so a signed-in officer
  // reloading a console page isn't sent to /login first.
  if (status === AUTH_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
    // This portal serves the officer roles only. Field roles (who use the
    // mobile app) and roles it doesn't know stop here, still signed in, with a
    // way out.
    return isWebRole(user?.role) ? <ConsoleRoutes /> : <WrongPlatformScreen />;
  }

  return <AuthRoutes />;
}
