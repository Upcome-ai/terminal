"use client";

import { useEffect, useState } from "react";
import { ConnectionStatus } from "@/lib/types";

function ago(ms: number | null, now: number): string {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

const STATUS_NOTE: Record<ConnectionStatus, string> = {
  connecting: "Establishing feed…",
  live: "Connected to live feed",
  reconnecting: "Link dropped — retrying…",
  offline: "No feed",
  demo: "Live feed unreachable — showing simulated wire",
};

export function StatusBar({
  status,
  columnCount,
  totalCount,
  lastMessageAt,
  feedUrl,
}: {
  status: ConnectionStatus;
  columnCount: number;
  totalCount: number;
  lastMessageAt: number | null;
  feedUrl: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-term-line-strong bg-term-panel px-3 text-[10.5px] text-term-muted">
      <div className="flex items-center gap-3">
        <span className="text-term-faint">{STATUS_NOTE[status]}</span>
        <span className="hidden text-term-faint sm:inline">|</span>
        <span className="hidden truncate font-mono text-term-faint sm:inline">
          {feedUrl}
        </span>
      </div>
      <div className="flex items-center gap-3 tabular-nums">
        <span>
          COLS <span className="text-term-text">{columnCount}</span>
        </span>
        <span className="text-term-faint">|</span>
        <span>
          EVENTS <span className="text-term-text">{totalCount}</span>
        </span>
        <span className="text-term-faint">|</span>
        <span>
          LAST{" "}
          <span className="text-term-text">{ago(lastMessageAt, now)}</span>
        </span>
      </div>
    </footer>
  );
}
