"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  eventsWebSocketUrl,
  displayEventsUrl,
  registerInterest,
} from "./api";
import {
  ConnectionStatus,
  normalizeEvent,
  UpcomeEvent,
  UpcomeWireEvent,
} from "./types";

/** Longest delay between reconnect attempts. */
const MAX_RECONNECT_DELAY_MS = 8000;

interface Options {
  /** Bearer session token used to authenticate the event stream. */
  token: string;
  /** Topics to register as interests and watch (includes WORLD). */
  interests: string[];
  /** Called for every incoming event. */
  onEvent: (event: UpcomeEvent) => void;
  /** Called when the backend rejects the token (e.g. it expired). */
  onAuthError?: () => void;
}

interface SocketState {
  status: ConnectionStatus;
  /** Epoch millis of the most recent message, or null. */
  lastMessageAt: number | null;
  /** The resolved feed URL (token omitted). */
  url: string;
}

/**
 * Manages the connection to the authenticated Upcome event feed.
 *
 * Behaviour:
 *  - Registers the user's column topics as interests over HTTP
 *    (`POST /user/interests`).
 *  - Opens a websocket to `/user/events?sessionToken=…` and forwards
 *    `{ topic, event, "more-info" }` frames.
 *  - Handles the `connection.ready` control frame.
 *  - Reconnects to the backend with exponential backoff on drop.
 */
export function useUpcomeSocket({
  token,
  interests,
  onEvent,
  onAuthError,
}: Options): SocketState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);

  // Keep mutable refs so the long-lived connection effect never needs to
  // re-run when interests or the callback identity change.
  const onEventRef = useRef(onEvent);
  const onAuthErrorRef = useRef(onAuthError);
  const interestsRef = useRef(interests);
  onEventRef.current = onEvent;
  onAuthErrorRef.current = onAuthError;
  interestsRef.current = interests;

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUnmount = useRef(false);

  const emit = useCallback((raw: UpcomeWireEvent) => {
    onEventRef.current(normalizeEvent(raw));
    setLastMessageAt(Date.now());
  }, []);

  // --- Live WebSocket --------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    closedByUnmount.current = false;
    attemptsRef.current = 0;

    function connect() {
      if (closedByUnmount.current) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(eventsWebSocketUrl(token));
      } catch {
        handleFailure();
        return;
      }
      wsRef.current = ws;
      setStatus(attemptsRef.current === 0 ? "connecting" : "reconnecting");

      ws.onopen = () => {
        attemptsRef.current = 0;
        setStatus("live");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string);
          // Control frame sent right after connect — not a news event.
          if (data && data.type === "connection.ready") {
            setStatus("live");
            return;
          }
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

      ws.onclose = (event) => {
        wsRef.current = null;
        if (closedByUnmount.current) return;
        // 1008 (policy violation) is how the Auth API signals a missing,
        // invalid, or expired session token. Retrying can't help — surface it
        // as an auth error so the app re-authenticates instead of reconnecting.
        if (event.code === 1008) {
          onAuthErrorRef.current?.();
          return;
        }
        handleFailure();
      };
    }

    function handleFailure() {
      attemptsRef.current += 1;
      setStatus("reconnecting");
      const delay = Math.min(
        1000 * 2 ** attemptsRef.current,
        MAX_RECONNECT_DELAY_MS
      );
      reconnectTimerRef.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      closedByUnmount.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    };
  }, [token, emit]);

  // --- Interest registration (HTTP) -----------------------------------------
  // Interests are registered over HTTP, not the websocket. Track what we've
  // already sent so re-renders don't re-post the same topics.
  const registeredRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    registeredRef.current = new Set();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const pending = interests.filter((t) => !registeredRef.current.has(t));
    if (pending.length === 0) return;

    (async () => {
      for (const topic of pending) {
        if (cancelled) return;
        try {
          await registerInterest(token, topic);
          registeredRef.current.add(topic);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            onAuthErrorRef.current?.();
            return;
          }
          // Transient failure (e.g. backend down) — leave it unregistered so a
          // later effect run retries it.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, interests]);

  return { status, lastMessageAt, url: displayEventsUrl() };
}
