import { Navigate, Route, Routes, useLocation } from 'react-router';

import LoginScreen from '../screens/auth/LoginScreen';

// Sends any URL but /login to /login, carrying the page that was asked for in
// location state so signing in lands there (see ConsoleRoutes).
function RedirectToLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location }} />;
}

// The signed-out routes. The web counterpart of app/src/navigation/AuthStack.js.
export default function AuthRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="*" element={<RedirectToLogin />} />
    </Routes>
  );
}
