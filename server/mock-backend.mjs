/**
 * Upcome mock Auth API backend.
 *
 * A local stand-in for the real Upcome backend so the terminal can be run and
 * tested end-to-end without external services. It implements the documented
 * Auth API surface:
 *
 *   POST /auth/login-code   Request a one-time email login code.
 *   POST /auth/session      Verify a code and exchange it for a JWT.
 *   GET  /user/interests    List the authenticated user's interests.
 *   POST /user/interests    Register a topic interest.
 *   WS   /user/events       Stream events for registered interests.
 *
 * The login code is NOT emailed anywhere — it is printed to this process's
 * console so you can copy it into the login screen during development.
 *
 * Run with:  npm run mock        (or)  node server/mock-backend.mjs
 * The client points at it via NEXT_PUBLIC_UPCOME_API_URL (default
 * http://localhost:7070).
 */
import { createServer } from "http";
import { createHash, createHmac } from "crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 7070);

// --- Login-code rules (mirrors the documented defaults) ---------------------
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

// --- Session (JWT) rules ----------------------------------------------------
// The Auth API hands out a JWT rather than an opaque token. It's signed with a
// throwaway secret and carries the user identity as claims, so authentication
// is stateless — every protected request/upgrade is validated by verifying the
// token, with no server-side session table to look up.
const JWT_SECRET = process.env.JWT_SECRET ?? "upcome-mock-dev-secret";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// --- In-memory state --------------------------------------------------------
/** email -> { code, expiresAt, attempts, sentAt } */
const challenges = new Map();
/** email -> Set<topic> */
const interests = new Map();
/**
 * email -> { jwt, exp } — the session JWT most recently issued to a user.
 *
 * Verifying an emailed code hands out a JWT that stays valid for its whole
 * lifetime, so there is no reason to mint a new one every time the same user
 * re-verifies. We cache the issued token and reuse it until it expires, only
 * signing a fresh JWT once the cached one has aged out.
 */
const sessions = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Documented topic rules: letters, numbers, `.`, `_`, `-`, max 50 chars.
const TOPIC_RE = /^[A-Z0-9._-]{1,50}$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Deterministic UUID derived from the normalized email (v5-style). */
function userIdFor(email) {
  const h = createHash("sha1").update(`upcome:user:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20
  )}-${h.slice(20, 32)}`;
}

// --- Minimal HS256 JWT helpers ----------------------------------------------
const b64url = (input) => Buffer.from(input).toString("base64url");

function signJwt(claims) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/**
 * Return a valid session JWT for `email`, reusing the token issued on a
 * previous verification while it is still within its lifetime and only minting
 * a fresh one once the cached token has expired.
 */
function sessionTokenFor(email) {
  const now = Date.now();
  const cached = sessions.get(email);
  if (cached && cached.exp * 1000 > now) {
    return cached.jwt;
  }
  const issuedAt = Math.floor(now / 1000);
  const exp = issuedAt + SESSION_TTL_SECONDS;
  const jwt = signJwt({ sub: userIdFor(email), email, iat: issuedAt, exp });
  sessions.set(email, { jwt, exp });
  return jwt;
}

/** Verify a JWT's signature and expiry; returns its claims or null. */
function verifyJwt(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  // Constant-time-ish comparison; length guard avoids timingSafeEqual throws.
  if (signature.length !== expected.length || signature !== expected) {
    return null;
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
    return null; // expired
  }
  return claims;
}

// --- Event catalog (Upcome wire format) -------------------------------------
const CATALOG = {
  WORLD: [
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

// --- HTTP helpers -----------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...CORS_HEADERS,
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(null); // signal invalid JSON
      }
    });
    req.on("error", () => resolve(null));
  });
}

function bearerToken(req) {
  const header = req.headers["authorization"] || "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  return match ? match[1].trim() : null;
}

/** Resolve the authenticated user from a bearer JWT, or null. */
function authenticate(req) {
  const claims = verifyJwt(bearerToken(req));
  if (!claims || typeof claims.email !== "string") return null;
  return { email: claims.email, user: userFromClaims(claims) };
}

function userFromClaims(claims) {
  return { id: claims.sub, email: claims.email };
}

// --- Route handlers ---------------------------------------------------------
async function handleLoginCode(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body?.email);
  if (body === null || !EMAIL_RE.test(email)) {
    return sendJson(res, 400, { error: "A valid email is required." });
  }

  const existing = challenges.get(email);
  const now = Date.now();
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    return sendJson(res, 429, {
      error: "Please wait before requesting another login code.",
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  challenges.set(email, {
    code,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
  });

  console.log(
    `[upcome-mock] login code for ${email}: \x1b[1;33m${code}\x1b[0m (valid 10m)`
  );

  return sendJson(res, 202, { message: "Login code sent" });
}

async function handleSession(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (body === null || !EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    return sendJson(res, 400, {
      error: "A valid email and code are required.",
    });
  }

  const challenge = challenges.get(email);
  const now = Date.now();
  const invalid = { error: "Invalid or expired login code." };

  if (!challenge || challenge.expiresAt < now) {
    challenges.delete(email);
    return sendJson(res, 401, invalid);
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    challenges.delete(email);
    return sendJson(res, 401, invalid);
  }
  if (challenge.code !== code) {
    challenge.attempts += 1;
    return sendJson(res, 401, invalid);
  }

  // Success — a verified code invalidates the outstanding challenge.
  challenges.delete(email);
  if (!interests.has(email)) interests.set(email, new Set());

  // Reuse the user's cached JWT while it is still valid; only mint a new one
  // once it has expired.
  const jwt = sessionTokenFor(email);

  return sendJson(
    res,
    200,
    { jwt, tokenType: "Bearer" },
    { "Cache-Control": "no-store" }
  );
}

async function handleGetInterests(req, res) {
  const session = authenticate(req);
  if (!session) {
    return sendJson(res, 401, { error: "A valid bearer token is required." });
  }
  const set = interests.get(session.email) ?? new Set();
  return sendJson(res, 200, {
    interests: [...set],
    websocketPath: "/user/events",
  });
}

async function handlePostInterest(req, res) {
  const session = authenticate(req);
  if (!session) {
    return sendJson(res, 401, { error: "A valid bearer token is required." });
  }
  const body = await readJson(req);
  const topic =
    typeof body?.topic === "string" ? body.topic.trim().toUpperCase() : "";
  if (body === null || !TOPIC_RE.test(topic)) {
    return sendJson(res, 400, { error: "A valid topic is required." });
  }

  const set = interests.get(session.email) ?? new Set();
  const added = !set.has(topic);
  set.add(topic);
  interests.set(session.email, set);

  return sendJson(
    res,
    200,
    {
      topic,
      added,
      interests: [...set],
      websocketPath: "/user/events",
      websocketTokenQueryParameter: "sessionToken",
    },
    { "Cache-Control": "no-store" }
  );
}

// --- HTTP server ------------------------------------------------------------
const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && pathname === "/auth/login-code") {
    return handleLoginCode(req, res);
  }
  if (req.method === "POST" && pathname === "/auth/session") {
    return handleSession(req, res);
  }
  if (req.method === "GET" && pathname === "/user/interests") {
    return handleGetInterests(req, res);
  }
  if (req.method === "POST" && pathname === "/user/interests") {
    return handlePostInterest(req, res);
  }

  sendJson(res, 404, { error: "Not found." });
});

// --- WebSocket: /user/events ------------------------------------------------
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/user/events") {
    socket.destroy();
    return;
  }
  const claims = verifyJwt(url.searchParams.get("sessionToken"));
  wss.handleUpgrade(req, socket, head, (ws) => {
    // Per the Auth API: a missing/invalid/expired JWT completes the handshake
    // and is then closed with WebSocket code 1008 (policy violation), rather
    // than being rejected at the HTTP layer.
    if (!claims || typeof claims.email !== "string") {
      ws.close(1008, "Invalid or expired session token.");
      return;
    }
    ws._email = claims.email;
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  const email = ws._email;
  const set = interests.get(email) ?? new Set();
  console.log(
    `[upcome-mock] events client connected: ${email} (${wss.clients.size} total)`
  );

  ws.send(
    JSON.stringify({
      type: "connection.ready",
      interests: [...set],
    })
  );

  // Send a quick burst of world backlog so new clients aren't empty.
  for (let i = 0; i < 4; i++) ws.send(JSON.stringify(makeEvent("WORLD")));

  ws.on("close", () =>
    console.log(
      `[upcome-mock] events client disconnected: ${email} (${wss.clients.size} total)`
    )
  );
});

// Broadcast loop: for each connected client, emit one event biased toward the
// user's registered interests, always mixing in world news.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const subs = [...(interests.get(ws._email) ?? [])].filter(
      (t) => t !== "WORLD"
    );
    const bag = ["WORLD", "WORLD", "WORLD", ...subs];
    const topic = bag[Math.floor(Math.random() * bag.length)];
    ws.send(JSON.stringify(makeEvent(topic)));
  }
}, 1800);

server.listen(PORT, () => {
  console.log(
    `[upcome-mock] Upcome mock backend listening on http://localhost:${PORT}`
  );
  console.log(
    `[upcome-mock] events websocket on ws://localhost:${PORT}/user/events`
  );
});
