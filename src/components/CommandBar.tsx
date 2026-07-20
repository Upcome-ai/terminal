"use client";

import { FormEvent, useState } from "react";

/**
 * Quick-subscribe suggestions shown next to the command line.
 *
 * The Auth API doesn't advertise a topic catalog, so the terminal offers a
 * curated shortlist of common symbols; anything else can be opened by typing it
 * into the command line.
 */
const QUICK_TOPICS = ["NVDA", "AAPL", "TSLA", "BTC", "OIL", "FED"];

export function CommandBar({
  onSubmit,
  existing,
}: {
  onSubmit: (topic: string) => void;
  existing: string[];
}) {
  const [value, setValue] = useState("");
  const existingSet = new Set(existing.map((t) => t.toUpperCase()));

  function submit(e: FormEvent) {
    e.preventDefault();
    const topic = value.trim().toUpperCase();
    if (!topic) return;
    onSubmit(topic);
    setValue("");
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-term-line-strong bg-term-panel-2 px-3 py-1.5">
      <form onSubmit={submit} className="flex flex-1 items-center gap-2">
        <span className="select-none text-[13px] font-bold text-amber">
          UPCOME&gt;
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="ENTER TOPIC / SYMBOL — e.g. NVDA — THEN PRESS GO"
          spellCheck={false}
          autoComplete="off"
          aria-label="Subscribe to a topic"
          className="min-w-0 flex-1 bg-transparent text-[13px] tracking-wider text-term-text caret-amber placeholder:text-term-faint focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 border border-amber-dim bg-transparent px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-amber transition-colors hover:bg-amber hover:text-black"
        >
          &lt;GO&gt;
        </button>
      </form>

      <div className="flex items-center gap-1.5">
        <span className="hidden text-[10px] uppercase tracking-widest text-term-faint md:inline">
          quick:
        </span>
        {QUICK_TOPICS.map((topic) => {
          const active = existingSet.has(topic);
          return (
            <button
              key={topic}
              onClick={() => !active && onSubmit(topic)}
              disabled={active}
              className={`border px-1.5 py-0.5 text-[11px] font-bold tracking-wider transition-colors ${
                active
                  ? "cursor-default border-term-line text-term-faint"
                  : "border-term-line-strong text-term-muted hover:border-amber-dim hover:text-amber"
              }`}
              title={active ? `${topic} already open` : `Open ${topic} column`}
            >
              {topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}
