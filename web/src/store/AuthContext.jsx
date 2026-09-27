import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { authApi } from '../api';
import { onSessionExpired } from '../api/client';
import tokenStorage from './tokenStorage';

export const AUTH_STATUS = {
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
};

const AuthContext = createContext(undefined);

// Trimmed from app/src/store/AuthContext.js to what the portal uses so far:
// the session, login and logout. Officers don't self-register, and the
// password and account calls get added here when a screen needs them.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);

  // Page-load bootstrap: a stored access token doesn't mean it's still valid,
  // so this round-trips through /auth/me. If it's expired, client.js's own
  // response interceptor transparently refreshes and retries before this
  // ever sees a failure - this only fails for real if refresh also fails.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const { accessToken } = await tokenStorage.getTokens();
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
        await tokenStorage.clearTokens();
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
  // session ends live instead of only on the next page load.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }),
    [],
  );

  // Logging out in one tab logs out every other tab. They all share the tokens
  // in localStorage, so without this the other tabs would keep showing the
  // console while every request they make fails for want of a token.
  useEffect(
    () =>
      tokenStorage.onClearedInOtherTab(() => {
        setUser(null);
        setStatus(AUTH_STATUS.UNAUTHENTICATED);
      }),
    [],
  );

  const login = useCallback(async ({ email, password }) => {
    const result = await authApi.login({ email, password });
    await tokenStorage.setTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setUser(result.user);
    setStatus(AUTH_STATUS.AUTHENTICATED);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const { accessToken, refreshToken } = await tokenStorage.getTokens();
    try {
      await authApi.logout({ accessToken, refreshToken });
    } finally {
      await tokenStorage.clearTokens();
      setUser(null);
      setStatus(AUTH_STATUS.UNAUTHENTICATED);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      logout,
    }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
