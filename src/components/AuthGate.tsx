"use client";

import { useAuth } from "@/lib/auth";
import { LoginScreen } from "./LoginScreen";
import { Terminal } from "./Terminal";

/**
 * Gates the platform behind authentication: until a valid session exists, the
 * user sees the login screen instead of the terminal.
 */
export function AuthGate() {
  const { hydrated, token } = useAuth();

  // Avoid flashing the login screen before the persisted session is read.
  if (!hydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-term-bg">
        <span className="text-[11px] uppercase tracking-widest text-term-faint">
          Loading terminal…
        </span>
      </div>
    );
  }

  return token ? <Terminal /> : <LoginScreen />;
}
