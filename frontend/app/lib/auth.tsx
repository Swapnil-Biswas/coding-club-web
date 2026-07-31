"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { PublicUser } from "./types";

export type AuthView = "login" | "signup" | "verify";

interface AuthContextValue {
  user: PublicUser | null;
  /** True once the initial /auth/me probe has resolved. */
  ready: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<PublicUser>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  // Auth modal bus: any component can open the login/signup/verify dialog.
  authModalOpen: boolean;
  authView: AuthView;
  presetEmail: string;
  openAuth: (view?: AuthView, email?: string) => void;
  closeAuth: () => void;
  setAuthView: (v: AuthView) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>("login");
  const [presetEmail, setPresetEmail] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: PublicUser | null }>("/auth/me");
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

  const openAuth = useCallback((view: AuthView = "login", email = "") => {
    setAuthView(view);
    setPresetEmail(email);
    setAuthModalOpen(true);
  }, []);

  const closeAuth = useCallback(() => setAuthModalOpen(false), []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ user: PublicUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setUser(data.user);
      setAuthModalOpen(false);
      return data.user;
    },
    [],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      await api("/auth/signup", {
        method: "POST",
        body: { name, email, password },
      });
      // Move to the verify step, carrying the email along.
      setPresetEmail(email);
      setAuthView("verify");
    },
    [],
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const data = await api<{ user: PublicUser }>("/auth/verify-email", {
      method: "POST",
      body: { email, code },
    });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, drop local state — the user wants out.
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      refresh,
      login,
      signup,
      verifyEmail,
      logout,
      authModalOpen,
      authView,
      presetEmail,
      openAuth,
      closeAuth,
      setAuthView,
    }),
    [
      user,
      ready,
      refresh,
      login,
      signup,
      verifyEmail,
      logout,
      authModalOpen,
      authView,
      presetEmail,
      openAuth,
      closeAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
