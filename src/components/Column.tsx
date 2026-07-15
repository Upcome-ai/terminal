"use client";

import { GLOBAL_TOPIC, UpcomeEvent } from "@/lib/types";
import { EventRow } from "./EventRow";

const TOPIC_LABELS: Record<string, string> = {
  [GLOBAL_TOPIC]: "GLOBAL — MAJOR WORLD NEWS",
};

export function Column({
  topic,
  pinned,
  events,
  onRemove,
}: {
  topic: string;
  pinned: boolean;
  events: UpcomeEvent[];
  onRemove: (topic: string) => void;
}) {
  const isGlobal = topic === GLOBAL_TOPIC;
  const label = TOPIC_LABELS[topic] ?? topic;

  return (
    <section
      className={`flex min-h-0 shrink-0 flex-col bg-term-panel ${
        isGlobal ? "w-[360px]" : "w-[320px]"
      }`}
    >
      {/* Header */}
      <div
        className={`flex h-8 shrink-0 items-center justify-between border-b px-2.5 ${
          isGlobal
            ? "border-amber-dim bg-[#150e02]"
            : "border-term-line-strong bg-term-panel-2"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate text-[12px] font-bold tracking-wider ${
              isGlobal ? "text-amber text-glow" : "text-amber"
            }`}
          >
            {label}
          </span>
          {pinned && (
            <span className="shrink-0 text-[9px] uppercase tracking-widest text-term-faint">
              pinned
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-[10px] text-term-muted">
            {events.length}
          </span>
          {!pinned && (
            <button
              onClick={() => onRemove(topic)}
              aria-label={`Close ${topic} column`}
              title={`Close ${topic}`}
              className="flex h-4 w-4 items-center justify-center text-term-muted transition-colors hover:bg-down hover:text-black"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-term-faint">
            {isGlobal
              ? "Awaiting global headlines…"
              : `No events yet for ${topic}. Watching the wire…`}
          </div>
        ) : (
          events.map((e) => <EventRow key={e.id} event={e} />)
        )}
      </div>
    </section>
  );
}
