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
  demo: { label: "DEMO FEED", color: "text-info", dot: true },
};

function useUtcClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TopBar({ status }: { status: ConnectionStatus }) {
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
                : status === "demo"
                ? "bg-info"
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
      </div>
    </header>
  );
}
