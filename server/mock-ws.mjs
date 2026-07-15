/**
 * Upcome mock WebSocket feed.
 *
 * Emits JSON frames in the Upcome wire format so the terminal has a live feed
 * to render during local development:
 *
 *   { "topic": "NVDA", "event": "NVDA CEO Sells $10,000 in shares", "more-info": "https://upcomenew.io/234" }
 *
 * Run with:  npm run mock       (or)  node server/mock-ws.mjs
 * The client connects via NEXT_PUBLIC_UPCOME_WS_URL (default ws://localhost:4001).
 *
 * It honours optional `{ "action": "subscribe", "topics": [...] }` messages from
 * the client by biasing the emitted topics toward what the user is watching, but
 * it also broadcasts global news regardless.
 */
import { WebSocketServer } from "ws";

const PORT = Number(process.env.UPCOME_WS_PORT ?? 4001);

const CATALOG = {
  GLOBAL: [
    "UN Security Council calls emergency session on energy corridor",
    "Global markets mixed as central banks signal rate pause",
    "Magnitude 6.1 quake reported off the Pacific coast, no tsunami warning",
    "G20 finance ministers agree framework on cross-border AI rules",
    "Oil steadies near $82 as OPEC+ holds output targets",
    "Major undersea cable outage disrupts intercontinental traffic",
    "Landmark climate accord clears final ratification hurdle",
    "Election results trigger currency swings across emerging markets",
    "Central bank surprises markets with emergency liquidity facility",
    "Cross-border summit yields joint statement on trade",
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

let counter = 200;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeEvent(topic) {
  const key = String(topic).toUpperCase();
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

const wss = new WebSocketServer({ port: PORT });
const interests = new Map(); // ws -> Set<topic>

wss.on("connection", (ws) => {
  interests.set(ws, new Set());
  console.log(`[upcome-mock] client connected (${wss.clients.size} total)`);

  // Send a quick burst of global backlog so new clients aren't empty.
  for (let i = 0; i < 4; i++) {
    ws.send(JSON.stringify(makeEvent("GLOBAL")));
  }

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg?.action === "subscribe" && Array.isArray(msg.topics)) {
        interests.set(ws, new Set(msg.topics.map((t) => String(t).toUpperCase())));
      }
    } catch {
      /* ignore */
    }
  });

  ws.on("close", () => {
    interests.delete(ws);
    console.log(`[upcome-mock] client disconnected (${wss.clients.size} total)`);
  });
});

// Broadcast loop: every tick, send one event per connected client biased toward
// its subscriptions, always mixing in global news.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const subs = [...(interests.get(ws) ?? [])];
    // Weight global news heavily so the GLOBAL column stays busy.
    const bag = ["GLOBAL", "GLOBAL", "GLOBAL", ...subs];
    const topic = bag[Math.floor(Math.random() * bag.length)];
    ws.send(JSON.stringify(makeEvent(topic)));
  }
}, 1800);

console.log(`[upcome-mock] Upcome mock feed listening on ws://localhost:${PORT}`);
