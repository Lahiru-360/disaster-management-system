import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { authApi } from '../api';
import { onSessionExpired } from '../api/client';
import secureStorage from './secureStorage';

export const AUTH_STATUS = {
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
};

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);

  // Launch bootstrap: a stored access token doesn't mean it's still valid,
  // so this round-trips through /auth/me. If it's expired, client.js's own
  // response interceptor transparently refreshes and retries before this
  // ever sees a failure - this only fails for real if refresh also fails.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const { accessToken } = await secureStorage.getTokens();
      if (!accessToken) {
        if (!cancelled) setStatus(AUTH_STATUS.UNAUTHENTICATED);
        return;
      }

      try {
        const result = await authApi.getCurrentUser({ accessToken });
        if (!cancelled) {
          setUser(result.user);
          setStatus(AUTH_STATUS.AUTHENTICATED);
        }
      } catch {
        await secureStorage.clearTokens();
        if (!cancelled) setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  // If a later request's silent refresh fails (refresh token itself
  // expired/revoked), client.js clears the tokens and calls this so the
  // session ends live instead of only on next launch.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }),
    [],
  );

  const register = useCallback(async ({ name, email, password, role }) => {
    const result = await authApi.register({ name, email, password, role });
    await secureStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    await secureStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    const { accessToken } = await secureStorage.getTokens();
    const result = await authApi.changePassword({ accessToken, currentPassword, newPassword });
    await secureStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return result;
  }, []);

  const logout = useCallback(async () => {
    const { accessToken, refreshToken } = await secureStorage.getTokens();
    try {
      await authApi.logout({ accessToken, refreshToken });
    } finally {
      await secureStorage.clearTokens();
      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
    }
  }, []);

  // Neither call touches a session - the person requesting or
  // completing a reset isn't signed in anywhere, so there's no token to
  // store and no user/status to update, unlike every other method here.
  const requestPasswordReset = useCallback(async ({ email }) => {
    return authApi.requestPasswordReset({ email });
  }, []);

  const resetPassword = useCallback(async ({ token, newPassword }) => {
    return authApi.resetPassword({ token, newPassword });
  }, []);

  // Ends the session through the same path as logout above - the
  // account itself is already gone server-side (every refresh token revoked
  // by the endpoint), so this always clears the local session in `finally`
  // regardless of how the request resolves.
  const deactivateAccount = useCallback(async () => {
    const { accessToken } = await secureStorage.getTokens();
    try {
      await authApi.deactivateAccount({ accessToken });
    } finally {
      await secureStorage.clearTokens();
      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      register,
      login,
      logout,
      changePassword,
      deactivateAccount,
      requestPasswordReset,
      resetPassword,
    }),
    [
      user,
      status,
      register,
      login,
      logout,
      changePassword,
      deactivateAccount,
      requestPasswordReset,
      resetPassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
