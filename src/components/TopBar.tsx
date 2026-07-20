"use client";

import { useEffect, useState } from "react";
import { ConnectionStatus } from "@/lib/types";

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; color: string; dot: boolean }
> = {
  connecting: { label: "CONNECTING", color: "text-amber", dot: false },
  live: { label: "LIVE", color: "text-up", dot: true },
  reconnecting: { label: "RECONNECTING", color: "text-amber", dot: false },
  offline: { label: "OFFLINE", color: "text-down", dot: false },
};

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </>
      )}
    </svg>
  );
}

function useUtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TopBar({
  status,
  userEmail,
  onLogout,
  soundMuted = false,
  onToggleSound,
}: {
  status: ConnectionStatus;
  userEmail?: string | null;
  onLogout?: () => void;
  soundMuted?: boolean;
  onToggleSound?: () => void;
}) {
  const now = useUtcClock();
  const meta = STATUS_META[status];

  const clock = now
    ? now.toISOString().slice(11, 19) + " UTC"
    : "--:--:-- UTC";
  const date = now ? now.toISOString().slice(0, 10) : "-------";

  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-term-line-strong bg-term-panel px-3">
      <div className="flex items-baseline gap-3">
        <span className="text-glow text-[15px] font-bold tracking-[0.2em] text-amber">
          UPCOME
        </span>
        <span className="hidden text-[11px] uppercase tracking-widest text-term-muted sm:inline">
          Live Events Terminal
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              meta.dot ? "live-dot" : ""
            } ${
              status === "live"
                ? "bg-up"
                : status === "offline"
                ? "bg-down"
                : "bg-amber"
            }`}
          />
          <span className={`font-bold tracking-wider ${meta.color}`}>
            {meta.label}
          </span>
        </div>
        <span className="hidden text-term-faint md:inline">|</span>
        <span className="tabular-nums text-term-muted">{date}</span>
        <span className="tabular-nums font-bold text-term-text">{clock}</span>

        {onToggleSound && (
          <>
            <span className="hidden text-term-faint md:inline">|</span>
            <button
              onClick={onToggleSound}
              className={`flex items-center gap-1 border border-term-line-strong px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors hover:border-amber hover:text-amber ${
                soundMuted ? "text-term-faint" : "text-up"
              }`}
              title={
                soundMuted
                  ? "Event sound off — click to enable"
                  : "Event sound on — click to mute"
              }
              aria-pressed={!soundMuted}
            >
              <SoundIcon muted={soundMuted} />
              <span className="hidden sm:inline">
                {soundMuted ? "Muted" : "Sound"}
              </span>
            </button>
          </>
        )}

        {userEmail && (
          <>
            <span className="hidden text-term-faint md:inline">|</span>
            <span
              className="hidden max-w-[180px] truncate text-term-muted lg:inline"
              title={userEmail}
            >
              {userEmail}
            </span>
            <button
              onClick={onLogout}
              className="border border-term-line-strong px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-term-muted transition-colors hover:border-down hover:text-down"
              title="Sign out"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
