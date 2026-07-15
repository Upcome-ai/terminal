"use client";

import { UpcomeEvent } from "@/lib/types";

/**
 * A Bloomberg-style scrolling headline ticker. Duplicates the content once so
 * the marquee loops seamlessly (the animation translates by -50%).
 */
export function Ticker({ events }: { events: UpcomeEvent[] }) {
  const items = events.length
    ? events
    : [
        {
          id: "placeholder",
          topic: "UPCOME",
          event: "Awaiting the wire…",
          moreInfo: "",
          receivedAt: Date.now(),
        },
      ];

  const doubled = [...items, ...items];

  return (
    <div className="relative h-7 shrink-0 overflow-hidden border-b border-term-line bg-black">
      <div className="marquee-track flex h-full w-max items-center whitespace-nowrap">
        {doubled.map((e, i) => (
          <span
            key={`${e.id}-${i}`}
            className="flex items-center gap-2 px-4 text-[12px]"
          >
            <span className="font-bold tracking-wider text-amber">
              {e.topic}
            </span>
            <span className="text-term-text">{e.event}</span>
            <span className="text-term-faint">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
