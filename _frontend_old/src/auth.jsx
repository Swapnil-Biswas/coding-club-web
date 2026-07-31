import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

// Auth state lives in a context so any component can read the current user
// without prop-drilling. The single source of truth is GET /auth/me — called
// once on mount. After that, login/logout update local state directly.

const AuthContext = createContext({ user: null, refresh: () => {}, logout: () => {} });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, drop local state — the user wants out.
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, refresh, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
