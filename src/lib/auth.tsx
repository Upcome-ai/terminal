"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AuthSession, SessionUser } from "./api";

/** localStorage key holding the persisted session. */
const SESSION_KEY = "upcome:session:v1";

interface AuthContextValue {
  /** True once the persisted session has been read on the client. */
  hydrated: boolean;
  /** The current session, or null when signed out. */
  session: AuthSession | null;
  /** Convenience: the bearer token, or null. */
  token: string | null;
  /** Convenience: the signed-in user, or null. */
  user: SessionUser | null;
  /** Persist a freshly verified session. */
  login: (session: AuthSession) => void;
  /** Clear the session and return to the login screen. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (
      parsed &&
      typeof parsed.sessionToken === "string" &&
      parsed.user &&
      typeof parsed.user.email === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Provides the current auth session to the tree and persists it to
 * localStorage. Session tokens are opaque secrets — they never appear in the
 * URL or the rendered chrome.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore any persisted session on mount (client only).
  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const login = useCallback((next: AuthSession) => {
    setSession(next);
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      session,
      token: session?.sessionToken ?? null,
      user: session?.user ?? null,
      login,
      logout,
    }),
    [hydrated, session, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
