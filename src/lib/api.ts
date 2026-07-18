/**
 * HTTP client for the Upcome Auth API.
 *
 * The backend base URL is configured with `NEXT_PUBLIC_UPCOME_API_URL`
 * (default `http://localhost:7070`). It exposes passwordless email login,
 * the user's topic interests, and an authenticated event websocket.
 *
 * See `docs`/the Auth API reference for the full contract.
 */

const RAW_API_BASE =
  process.env.NEXT_PUBLIC_UPCOME_API_URL ?? "http://localhost:7070";

/** Backend base URL with any trailing slashes stripped. */
export const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

/** The authenticated user returned by `POST /auth/session`. */
export interface SessionUser {
  id: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
}

/** A verified session: the bearer token plus the user it belongs to. */
export interface AuthSession {
  sessionToken: string;
  tokenType: string;
  user: SessionUser;
}

/** A topic carried on the wire, as advertised by the backend catalog. */
export interface CatalogTopic {
  /** Normalised topic symbol, e.g. "NVDA" or "GLOBAL". */
  topic: string;
  /** How many distinct stories the backend can surface for the topic. */
  headlines: number;
  /** True for the always-on major-world-news topic. */
  global: boolean;
}

/** An error carrying the HTTP status and the server's message, if any. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Read the `{ "error": "..." }` body (if present) and throw an ApiError. */
async function fail(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") message = body.error;
  } catch {
    /* non-JSON body — keep the fallback */
  }
  throw new ApiError(message, res.status);
}

/**
 * Request a one-time login code for `email`.
 *
 * Resolves on `202 Accepted`. Throws {@link ApiError} otherwise — notably
 * status `429` when a code was requested too recently (resend cooldown).
 */
export async function requestLoginCode(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (res.status === 202) return;
  await fail(res, "Unable to send a login code right now.");
}

/**
 * Verify a login `code` for `email` and create a session.
 *
 * Throws {@link ApiError} with status `401` when the code is wrong, expired,
 * already used, or too many attempts were made.
 */
export async function verifyLoginCode(
  email: string,
  code: string
): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) await fail(res, "Invalid or expired login code.");
  return (await res.json()) as AuthSession;
}

/**
 * List the topics the backend carries on the wire.
 *
 * This is a public catalog (no auth required) used to showcase what can be
 * subscribed to. Returns an empty list if the backend is unreachable so the UI
 * can fall back gracefully.
 */
export async function listTopics(): Promise<CatalogTopic[]> {
  const res = await fetch(`${API_BASE}/topics`);
  if (!res.ok) await fail(res, "Unable to load the topic catalog.");
  const body = await res.json();
  const raw: unknown = body?.topics;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter(
      (t): t is { topic: string; headlines?: unknown; global?: unknown } =>
        !!t && typeof (t as { topic?: unknown }).topic === "string"
    )
    .map((t) => ({
      topic: t.topic.trim().toUpperCase(),
      headlines: typeof t.headlines === "number" ? t.headlines : 0,
      global: t.global === true,
    }));
}

/** List the authenticated user's registered topic interests. */
export async function listInterests(token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/user/interests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await fail(res, "A valid bearer token is required.");
  const body = await res.json();
  return Array.isArray(body.interests) ? body.interests : [];
}

/**
 * Register `topic` as an interest for the authenticated user.
 *
 * Returns the user's full interest list after the update.
 */
export async function registerInterest(
  token: string,
  topic: string
): Promise<string[]> {
  const res = await fetch(`${API_BASE}/user/interests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) await fail(res, "A valid topic is required.");
  const body = await res.json();
  return Array.isArray(body.interests) ? body.interests : [];
}

/** ws(s):// URL for the event stream, authenticated with the session token. */
export function eventsWebSocketUrl(token: string): string {
  const url = new URL("/user/events", API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("sessionToken", token);
  return url.toString();
}

/** ws(s):// event-stream URL without the token — safe to show in the UI. */
export function displayEventsUrl(): string {
  const url = new URL("/user/events", API_BASE);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
