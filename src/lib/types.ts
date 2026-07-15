/**
 * The wire format emitted by the Upcome live-event WebSocket feed.
 *
 *   {
 *     "topic": "NVDA",
 *     "event": "NVDA CEO Sells $10,000 in shares",
 *     "more-info": "https://upcomenew.io/234"
 *   }
 */
export interface UpcomeWireEvent {
  topic: string;
  event: string;
  "more-info": string;
}

/** An event after it has been ingested by the terminal. */
export interface UpcomeEvent {
  /** Stable client-side id. */
  id: string;
  /** Normalised topic symbol, e.g. "NVDA" or "GLOBAL". */
  topic: string;
  /** Headline text. */
  event: string;
  /** Link to the full story. */
  moreInfo: string;
  /** Epoch millis the event was received by the client. */
  receivedAt: number;
}

/** The always-on major-global-news topic. */
export const GLOBAL_TOPIC = "GLOBAL";

/** A subscribed column in the terminal. */
export interface Column {
  /** Topic symbol this column tracks. */
  topic: string;
  /** Whether the column is pinned (the GLOBAL column can't be removed). */
  pinned: boolean;
}

export type ConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "offline"
  | "demo";

/** Convert a raw wire event into the terminal's internal shape. */
export function normalizeEvent(raw: UpcomeWireEvent): UpcomeEvent {
  const topic = (raw.topic || GLOBAL_TOPIC).trim().toUpperCase();
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    topic,
    event: raw.event ?? "",
    moreInfo: raw["more-info"] ?? "",
    receivedAt: Date.now(),
  };
}
