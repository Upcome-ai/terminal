"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionStatus,
  GLOBAL_TOPIC,
  normalizeEvent,
  UpcomeEvent,
  UpcomeWireEvent,
} from "./types";
import { makeMockEvent } from "./mockEvents";

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_UPCOME_WS_URL ?? "ws://localhost:4001";

/** How many connection attempts before we drop into the in-browser demo feed. */
const MAX_ATTEMPTS = 3;

interface Options {
  /** Topics the user is subscribed to (excluding GLOBAL, which is implicit). */
  subscriptions: string[];
  /** Called for every incoming event. */
  onEvent: (event: UpcomeEvent) => void;
}

interface SocketState {
  status: ConnectionStatus;
  /** Epoch millis of the most recent message, or null. */
  lastMessageAt: number | null;
  /** The resolved feed URL. */
  url: string;
}

/**
 * Manages the connection to the Upcome live-event feed.
 *
 * Behaviour:
 *  - Opens a WebSocket to `NEXT_PUBLIC_UPCOME_WS_URL`.
 *  - Parses `{ topic, event, "more-info" }` frames and forwards them.
 *  - Reconnects with exponential backoff on drop.
 *  - After a few failed attempts, falls back to a client-side demo feed so the
 *    terminal is never blank in an environment with no backend.
 */
export function useUpcomeSocket({ subscriptions, onEvent }: Options): SocketState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);

  // Keep mutable refs so the long-lived connection effect never needs to
  // re-run when subscriptions or the callback identity change.
  const onEventRef = useRef(onEvent);
  const subsRef = useRef(subscriptions);
  onEventRef.current = onEvent;
  subsRef.current = subscriptions;

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUnmount = useRef(false);

  const emit = useCallback((raw: UpcomeWireEvent) => {
    onEventRef.current(normalizeEvent(raw));
    setLastMessageAt(Date.now());
  }, []);

  // --- In-browser demo feed --------------------------------------------------
  const startDemo = useCallback(() => {
    if (demoTimerRef.current) return;
    setStatus("demo");
    const tick = () => {
      // Always surface global news; sprinkle in subscribed topics.
      const topics = [GLOBAL_TOPIC, GLOBAL_TOPIC, ...subsRef.current];
      const topic = topics[Math.floor(Math.random() * topics.length)];
      emit(makeMockEvent(topic));
    };
    tick();
    demoTimerRef.current = setInterval(tick, 2600);
  }, [emit]);

  const stopDemo = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  }, []);

  // --- Live WebSocket --------------------------------------------------------
  useEffect(() => {
    closedByUnmount.current = false;

    function connect() {
      if (closedByUnmount.current) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(DEFAULT_WS_URL);
      } catch {
        handleFailure();
        return;
      }
      wsRef.current = ws;
      setStatus(attemptsRef.current === 0 ? "connecting" : "reconnecting");

      ws.onopen = () => {
        attemptsRef.current = 0;
        stopDemo();
        setStatus("live");
        // Optional: announce interest to feeds that honour subscriptions.
        try {
          ws.send(
            JSON.stringify({ action: "subscribe", topics: subsRef.current })
          );
        } catch {
          /* feed may be broadcast-only; ignore */
        }
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          const frames: UpcomeWireEvent[] = Array.isArray(data) ? data : [data];
          for (const frame of frames) {
            if (frame && typeof frame.event === "string") emit(frame);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUnmount.current) return;
        handleFailure();
      };
    }

    function handleFailure() {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        startDemo();
        return;
      }
      setStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** attemptsRef.current, 8000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      closedByUnmount.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopDemo();
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    };
  }, [emit, startDemo, stopDemo]);

  // Forward subscription changes to a live feed.
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ action: "subscribe", topics: subscriptions }));
      } catch {
        /* noop */
      }
    }
  }, [subscriptions]);

  return { status, lastMessageAt, url: DEFAULT_WS_URL };
}
