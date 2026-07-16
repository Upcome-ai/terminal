"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, requestLoginCode, verifyLoginCode } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Resend cooldown in seconds — mirrors the backend default. */
const RESEND_COOLDOWN = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "email" | "code";

export function LoginScreen() {
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement>(null);

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Focus the code field when we advance to it.
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  const emailValid = EMAIL_RE.test(email.trim());
  const codeValid = /^\d{6}$/.test(code.trim());

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!emailValid || pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await requestLoginCode(email.trim());
      setStep("code");
      setCooldown(RESEND_COOLDOWN);
      setNotice("A 6-digit login code is on its way to your inbox.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // A code was requested recently — let the user enter the one they have.
        setStep("code");
        setCooldown(RESEND_COOLDOWN);
        setNotice("A code was already sent recently — check your inbox.");
      } else {
        setError(messageFor(err));
      }
    } finally {
      setPending(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!codeValid || pending) return;
    setPending(true);
    setError(null);
    try {
      const session = await verifyLoginCode(email.trim(), code.trim());
      login(session); // unmounts this screen and reveals the terminal
    } catch (err) {
      setError(messageFor(err));
      setCode("");
      codeInputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await requestLoginCode(email.trim());
      setCooldown(RESEND_COOLDOWN);
      setNotice("A new login code has been sent.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setCooldown(RESEND_COOLDOWN);
        setNotice("Please wait before requesting another code.");
      } else {
        setError(messageFor(err));
      }
    } finally {
      setPending(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setNotice(null);
    setCooldown(0);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-term-bg px-4">
      <div className="w-full max-w-[420px] border border-term-line-strong bg-term-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-term-line-strong bg-term-panel-2 px-4 py-3">
          <span className="text-glow text-[15px] font-bold tracking-[0.2em] text-amber">
            UPCOME
          </span>
          <span className="text-[10px] uppercase tracking-widest text-term-faint">
            secure terminal
          </span>
        </div>

        <div className="px-6 py-6">
          <h1 className="text-[12px] font-bold uppercase tracking-widest text-term-text">
            {step === "email" ? "Sign in" : "Enter login code"}
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-term-muted">
            {step === "email"
              ? "Access to the live-events terminal requires authentication. Enter your email to receive a one-time login code."
              : `We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`}
          </p>

          {step === "email" ? (
            <form onSubmit={submitEmail} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-term-faint">
                  Email address
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  autoComplete="email"
                  spellCheck={false}
                  aria-label="Email address"
                  className="w-full border border-term-line-strong bg-term-bg px-3 py-2 text-[13px] tracking-wide text-term-text caret-amber placeholder:text-term-faint focus:border-amber-dim focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={!emailValid || pending}
                className="w-full border border-amber-dim bg-transparent px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-amber transition-colors hover:bg-amber hover:text-black disabled:cursor-not-allowed disabled:border-term-line disabled:text-term-faint disabled:hover:bg-transparent"
              >
                {pending ? "Sending…" : "Send login code"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-term-faint">
                  6-digit code
                </span>
                <input
                  ref={codeInputRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="••••••"
                  aria-label="6-digit login code"
                  className="w-full border border-term-line-strong bg-term-bg px-3 py-2 text-center text-[18px] tracking-[0.5em] tabular-nums text-term-text caret-amber placeholder:text-term-faint focus:border-amber-dim focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={!codeValid || pending}
                className="w-full border border-amber-dim bg-transparent px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-amber transition-colors hover:bg-amber hover:text-black disabled:cursor-not-allowed disabled:border-term-line disabled:text-term-faint disabled:hover:bg-transparent"
              >
                {pending ? "Verifying…" : "Verify & enter terminal"}
              </button>

              <div className="flex items-center justify-between pt-1 text-[10px] uppercase tracking-widest">
                <button
                  type="button"
                  onClick={changeEmail}
                  className="text-term-muted transition-colors hover:text-amber"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown > 0 || pending}
                  className="text-term-muted transition-colors hover:text-amber disabled:cursor-not-allowed disabled:text-term-faint disabled:hover:text-term-faint"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {/* Feedback */}
          {error && (
            <p
              role="alert"
              className="mt-4 border border-down/40 bg-down/10 px-3 py-2 text-[11px] text-down"
            >
              {error}
            </p>
          )}
          {!error && notice && (
            <p className="mt-4 border border-term-line-strong bg-term-panel-2 px-3 py-2 text-[11px] text-term-muted">
              {notice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  // Network / CORS / DNS failures land here.
  return "Can't reach the Upcome backend. Check your connection and try again.";
}
