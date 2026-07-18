"use client";

import { FormEvent, useState } from "react";
import { CatalogTopic } from "@/lib/api";

/** Used only when the backend catalog can't be reached. */
const FALLBACK_SUGGESTIONS = ["NVDA", "AAPL", "TSLA", "BTC", "OIL", "FED"];

export function CommandBar({
  onSubmit,
  existing,
  catalog,
  catalogLoading = false,
}: {
  onSubmit: (topic: string) => void;
  existing: string[];
  /** Subscribable topics advertised by the backend (GLOBAL excluded). */
  catalog: CatalogTopic[];
  /** True while the backend catalog is still loading. */
  catalogLoading?: boolean;
}) {
  const [value, setValue] = useState("");
  const existingSet = new Set(existing.map((t) => t.toUpperCase()));

  // Prefer the live backend catalog; fall back to a static list if it's empty.
  const usingCatalog = catalog.length > 0;
  const chips: CatalogTopic[] = usingCatalog
    ? catalog
    : FALLBACK_SUGGESTIONS.map((topic) => ({
        topic,
        headlines: 0,
        global: false,
      }));

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
          {catalogLoading
            ? "loading wire…"
            : usingCatalog
            ? `${chips.length} on wire:`
            : "quick:"}
        </span>
        {chips.map((t) => {
          const active = existingSet.has(t.topic);
          const title = active
            ? `${t.topic} already open`
            : t.headlines > 0
            ? `Open ${t.topic} column — ${t.headlines} stor${
                t.headlines === 1 ? "y" : "ies"
              } on the wire`
            : `Open ${t.topic} column`;
          return (
            <button
              key={t.topic}
              onClick={() => !active && onSubmit(t.topic)}
              disabled={active}
              className={`border px-1.5 py-0.5 text-[11px] font-bold tracking-wider transition-colors ${
                active
                  ? "cursor-default border-term-line text-term-faint"
                  : "border-term-line-strong text-term-muted hover:border-amber-dim hover:text-amber"
              }`}
              title={title}
            >
              {t.topic}
            </button>
          );
        })}
      </div>
    </div>
  );
}
