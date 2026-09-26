// Keeps the session's tokens between page loads. Same interface as the app's
// store/secureStorage.js (async getTokens / setTokens / clearTokens), so
// api/client.js and AuthContext use it the same way.
//
// Security trade-off: localStorage can be read by any script running on the
// page, so an XSS bug anywhere in the portal would let an attacker read the
// refresh token and keep a session going from elsewhere. That's accepted for
// now. The usual fix is for the server to set the refresh token as an
// httpOnly cookie, which scripts can't read, with the short-lived access
// token kept in memory. That needs server changes, so it's left for later.

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

async function getTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

async function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

async function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Calls `handler` when another tab of the portal clears the tokens, which is
// what logging out (or a failed refresh) does. Every tab shares one
// localStorage, so the session there is gone too. The browser fires `storage`
// events only in the other tabs, never in the tab that made the change.
// Returns an unsubscribe function.
function onClearedInOtherTab(handler) {
  const listener = (event) => {
    if (event.storageArea !== localStorage) return;
    // `key` is null when all of localStorage was cleared at once.
    const accessTokenRemoved =
      (event.key === ACCESS_TOKEN_KEY || event.key === null) && event.newValue === null;
    if (accessTokenRemoved) handler();
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export default { getTokens, setTokens, clearTokens, onClearedInOtherTab };
