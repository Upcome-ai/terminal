"use client";

import { memo, useEffect, useRef, useState } from "react";
import { UpcomeEvent } from "@/lib/types";

function timeOf(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(11, 19);
}

function EventRowInner({ event }: { event: UpcomeEvent }) {
  // Flash only when the row first appears, not on every re-render.
  const [flash, setFlash] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // Skip the flash for backlog rendered on initial mount.
    if (Date.now() - event.receivedAt < 2000) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(id);
    }
  }, [event.receivedAt]);

  const hasLink = Boolean(event.moreInfo);

  return (
    <article
      className={`group border-b border-term-line px-2.5 py-1.5 ${
        flash ? "row-flash" : ""
      }`}
    >
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <time className="tabular-nums text-[10.5px] font-bold tracking-wider text-amber-dim">
          {timeOf(event.receivedAt)}
        </time>
        <span className="text-[9.5px] uppercase tracking-widest text-term-faint">
          {event.topic}
        </span>
      </div>
      <p className="text-[12.5px] leading-snug text-term-text">{event.event}</p>
      {hasLink && (
        <a
          href={event.moreInfo}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-info opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
        >
          more-info ↗
        </a>
      )}
    </article>
  );
}

export const EventRow = memo(EventRowInner);
