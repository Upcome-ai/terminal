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

/**
 * A verified session, as returned by `POST /auth/session`.
 *
 * The bearer credential is a JWT: it is self-describing, so the signed-in
 * user's identity is read from the token's claims rather than a separate
 * `user` object (see {@link decodeJwt} / {@link sessionUser}).
 */
export interface AuthSession {
  jwt: string;
  tokenType: string;
}

/** The signed-in user, derived from the JWT claims. */
export interface SessionUser {
  /** Stable user id (the JWT `sub` claim). */
  id: string;
  /** The user's email (the JWT `email` claim). */
  email: string;
}

/** Claims we read out of the session JWT. */
export interface JwtClaims {
  sub?: string;
  email?: string;
  iat?: number;
  /** Expiry, in seconds since the epoch. */
  exp?: number;
}

/**
 * Decode (without verifying) the payload of a JWT.
 *
 * Signature verification is the backend's job; the client only needs the
 * claims to display the user and know when the token has expired.
 */
export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json =
      typeof atob === "function"
        ? atob(base64UrlToBase64(parts[1]))
        : Buffer.from(parts[1], "base64url").toString("utf8");
    const claims = JSON.parse(json) as JwtClaims;
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

function base64UrlToBase64(value: string): string {
  const padded = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  );
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}

/** True once the JWT's `exp` claim is in the past. */
export function isJwtExpired(claims: JwtClaims | null): boolean {
  return !!claims && typeof claims.exp === "number" && claims.exp * 1000 <= Date.now();
}

/** Derive the signed-in {@link SessionUser} from a session JWT, if valid. */
export function sessionUser(token: string): SessionUser | null {
  const claims = decodeJwt(token);
  if (!claims || typeof claims.email !== "string" || isJwtExpired(claims)) {
    return null;
  }
  return { id: claims.sub ?? claims.email, email: claims.email };
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
  const body = await res.json();
  if (!body || typeof body.jwt !== "string") {
    throw new ApiError("The server returned an unexpected session.", res.status);
  }
  return {
    jwt: body.jwt,
    tokenType: typeof body.tokenType === "string" ? body.tokenType : "Bearer",
  };
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
