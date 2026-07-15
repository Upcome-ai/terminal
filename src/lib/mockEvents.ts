import type { UpcomeWireEvent } from "./types";

/**
 * A small catalog of realistic-looking headlines keyed by topic. Used by the
 * in-browser demo feed that runs when the live WebSocket can't be reached, so
 * the terminal never looks dead. The bundled mock server (`server/mock-ws.mjs`)
 * carries an equivalent catalog for local development.
 */
const CATALOG: Record<string, string[]> = {
  GLOBAL: [
    "UN Security Council calls emergency session on energy corridor",
    "Global markets mixed as central banks signal rate pause",
    "Magnitude 6.1 quake reported off the Pacific coast, no tsunami warning",
    "G20 finance ministers agree framework on cross-border AI rules",
    "Oil steadies near $82 as OPEC+ holds output targets",
    "Major undersea cable outage disrupts intercontinental traffic",
    "Landmark climate accord clears final ratification hurdle",
    "Election results trigger currency swings across emerging markets",
  ],
  NVDA: [
    "NVDA CEO Sells $10,000 in shares",
    "Nvidia unveils next-gen data-center GPU roadmap",
    "Nvidia beats revenue estimates on AI demand",
    "Nvidia expands supply agreement with major cloud provider",
    "Analysts raise Nvidia price target after earnings call",
  ],
  AAPL: [
    "Apple confirms fall hardware event date",
    "Apple Services revenue hits new all-time high",
    "Apple faces new antitrust probe in the EU",
    "Apple supplier signals stronger-than-expected orders",
  ],
  BTC: [
    "Bitcoin breaks above key resistance on ETF inflows",
    "Large BTC transfer moves $240M off exchange",
    "Regulator clarifies stance on spot crypto custody",
    "Bitcoin network hashrate hits record high",
  ],
  TSLA: [
    "Tesla begins deliveries of refreshed model line",
    "Tesla energy storage deployments jump quarter-over-quarter",
    "Tesla recalls software build over display glitch",
  ],
  OIL: [
    "Crude inventories fall more than expected",
    "Refinery outage tightens regional fuel supply",
    "Analysts revise year-end oil price forecast higher",
  ],
  FED: [
    "Fed official signals data-dependent approach to cuts",
    "FOMC minutes reveal split on inflation outlook",
    "Treasury yields ease after dovish Fed commentary",
  ],
};

const FALLBACK = [
  "Breaking developments reported on {TOPIC}",
  "{TOPIC} sees unusual activity in early session",
  "Sources say {TOPIC} outlook under review",
  "Fresh headline crosses the wire on {TOPIC}",
];

let counter = 1000;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Produce a single mock wire event for the given topic. */
export function makeMockEvent(topic: string): UpcomeWireEvent {
  const key = topic.toUpperCase();
  const pool = CATALOG[key];
  const headline = pool
    ? pick(pool)
    : pick(FALLBACK).replaceAll("{TOPIC}", key);
  return {
    topic: key,
    event: headline,
    "more-info": `https://upcomenew.io/${counter++}`,
  };
}

/** Topics that the demo feed emits by default (in addition to subscriptions). */
export const DEMO_TOPICS = Object.keys(CATALOG);
