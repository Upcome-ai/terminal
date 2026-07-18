"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Column as ColumnType,
  ConnectionStatus,
  GLOBAL_TOPIC,
  UpcomeEvent,
} from "@/lib/types";
import { useUpcomeSocket } from "@/lib/useUpcomeSocket";
import { useNotificationSound } from "@/lib/useNotificationSound";
import { useTopicCatalog } from "@/lib/useTopicCatalog";
import { useAuth } from "@/lib/auth";
import { TopBar } from "./TopBar";
import { CommandBar } from "./CommandBar";
import { Column } from "./Column";
import { StatusBar } from "./StatusBar";

const STORAGE_KEY = "upcome:columns:v1";
const MAX_PER_TOPIC = 120;

const DEFAULT_COLUMNS: ColumnType[] = [
  { topic: GLOBAL_TOPIC, pinned: true },
  { topic: "NVDA", pinned: false },
  { topic: "BTC", pinned: false },
];

function loadColumns(): ColumnType[] {
  if (typeof window === "undefined") return DEFAULT_COLUMNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as ColumnType[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_COLUMNS;
    // Guarantee the GLOBAL column is always present and pinned first.
    const rest = parsed.filter((c) => c.topic !== GLOBAL_TOPIC);
    return [{ topic: GLOBAL_TOPIC, pinned: true }, ...rest];
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function Terminal() {
  const { token, user, logout } = useAuth();
  const [columns, setColumns] = useState<ColumnType[]>(DEFAULT_COLUMNS);
  const [eventsByTopic, setEventsByTopic] = useState<
    Record<string, UpcomeEvent[]>
  >({});
  const [totalCount, setTotalCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted columns on mount (client only).
  useEffect(() => {
    setColumns(loadColumns());
    setHydrated(true);
  }, []);

  // Persist column layout.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    } catch {
      /* storage may be unavailable */
    }
  }, [columns, hydrated]);

  // Every column topic is registered as an interest — including GLOBAL, so the
  // pinned column receives major world news from the authenticated feed.
  const interests = useMemo(() => columns.map((c) => c.topic), [columns]);

  const { play: playChime, muted, toggleMuted } = useNotificationSound();

  // The backend advertises which topics are on the wire; the command bar
  // showcases them as quick-subscribe chips. GLOBAL is pinned already, so it's
  // filtered out of the addable set.
  const { topics: catalogTopics, loading: catalogLoading } = useTopicCatalog();
  const subscribableTopics = useMemo(
    () => catalogTopics.filter((t) => !t.global && t.topic !== GLOBAL_TOPIC),
    [catalogTopics],
  );

  const onEvent = useCallback(
    (event: UpcomeEvent) => {
      setEventsByTopic((prev) => {
        const bucket = prev[event.topic] ?? [];
        const next = [event, ...bucket].slice(0, MAX_PER_TOPIC);
        return { ...prev, [event.topic]: next };
      });
      setTotalCount((c) => c + 1);
      // Audible cue for freshly arrived events (respects the mute toggle).
      playChime();
    },
    [playChime],
  );

  const { status, lastMessageAt, url } = useUpcomeSocket({
    token: token ?? "",
    interests,
    onEvent,
    onAuthError: logout,
  });

  const addColumn = useCallback((rawTopic: string) => {
    const topic = rawTopic.trim().toUpperCase();
    if (!topic) return;
    setColumns((prev) => {
      if (prev.some((c) => c.topic === topic)) return prev;
      return [...prev, { topic, pinned: false }];
    });
  }, []);

  const removeColumn = useCallback((topic: string) => {
    if (topic === GLOBAL_TOPIC) return;
    setColumns((prev) => prev.filter((c) => c.topic !== topic));
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-term-bg">
      <TopBar
        status={status}
        userEmail={user?.email ?? null}
        onLogout={logout}
        soundMuted={muted}
        onToggleSound={toggleMuted}
      />
      <CommandBar
        onSubmit={addColumn}
        existing={columns.map((c) => c.topic)}
        catalog={subscribableTopics}
        catalogLoading={catalogLoading}
      />

      <main className="flex min-h-0 flex-1 gap-px overflow-x-auto bg-term-line px-px">
        {columns.map((col) => (
          <Column
            key={col.topic}
            topic={col.topic}
            pinned={col.pinned}
            events={eventsByTopic[col.topic] ?? []}
            onRemove={removeColumn}
          />
        ))}
      </main>

      <StatusBar
        status={status}
        columnCount={columns.length}
        totalCount={totalCount}
        lastMessageAt={lastMessageAt}
        feedUrl={url}
      />
    </div>
  );
}

export type { ConnectionStatus };
