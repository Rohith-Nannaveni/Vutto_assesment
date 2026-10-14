import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/index.js';
import { setCsrfToken, setSessionInvalidHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const applySession = useCallback((data) => {
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    setSessionExpired(false);
  }, []);

  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setUser(null);
  }, []);

  // Restore the session after a refresh. A 401 here just means "not signed in".
  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then(({ data }) => { if (!cancelled) applySession(data); })
      .catch(() => { if (!cancelled) clearSession(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applySession, clearSession]);

  // An expired/invalid token on any later request signs the user out and explains why.
  useEffect(() => {
    setSessionInvalidHandler(() => { clearSession(); setSessionExpired(true); });
    return () => setSessionInvalidHandler(null);
  }, [clearSession]);

  const login = useCallback(async (credentials) => { applySession((await authApi.login(credentials)).data); }, [applySession]);
  const register = useCallback(async (details) => { applySession((await authApi.register(details)).data); }, [applySession]);
  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { clearSession(); }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, register, logout, isAdmin: user?.role === 'admin' }),
    [user, loading, sessionExpired, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
