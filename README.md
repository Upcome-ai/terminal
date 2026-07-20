# UPCOME — Live Events Terminal

A **Bloomberg-style terminal for live events across the world**. Subscribe to a
topic and it opens a column; that column fills with news for the topic as it
crosses the wire. A pinned **WORLD** column for major world news is always on.

Access requires signing in: the terminal is gated behind passwordless **email
login** against the Upcome backend, and the live feed is streamed over an
**authenticated** websocket tied to your account's registered interests.

Built with the latest **Next.js 16** (App Router) and **Tailwind CSS v4**.

![Upcome terminal](docs/preview.png)

## The backend

The terminal talks to the Upcome backend (`NEXT_PUBLIC_UPCOME_API_URL`,
default `http://localhost:7070`) for three things:

- **Login** — `POST /auth/login-code` requests a one-time code by email, and
  `POST /auth/session` exchanges the code for a **JWT**. The signed-in user's
  identity is read from the token's claims.
- **Interests** — each open column is registered as a topic interest via
  `POST /user/interests`; `GET /user/interests` lists them.
- **Events** — the authenticated websocket at
  `ws(s)://<host>/user/events?sessionToken=…` streams updates for your
  registered interests. A missing, invalid, or expired token is closed with
  WebSocket code `1008`.

The full contract lives in [`docs/auth-api.md`](docs/auth-api.md).

## The wire format

Once connected, the event websocket renders JSON frames of the form:

```json
{
  "topic": "NVDA",
  "event": "NVDA CEO Sells $10,000 in shares",
  "more-info": "https://upcomenew.io/234"
}
```

- `topic` — the symbol/topic the event belongs to. It's routed to the matching
  column (case-insensitive). Events with topic `WORLD` feed the pinned column.
- `event` — the headline shown in the feed.
- `more-info` — a link to the full story (surfaced on row hover).

Interests are registered over HTTP, so the client does not push subscriptions
over the websocket — opening a column calls `POST /user/interests` instead.

## Getting started

```bash
npm install

# Run the app + the bundled mock backend together:
npm run dev:all
# → http://localhost:3000  (backend: http://localhost:7070)
```

Or run them separately:

```bash
npm run mock   # mock Upcome backend on http://localhost:7070
npm run dev    # Next.js dev server on http://localhost:3000
```

### Signing in

The terminal opens on a login screen:

1. Enter your email and press **Send login code**.
2. Read the 6-digit code from your inbox — or, with the bundled mock backend,
   from the **`npm run mock` terminal output** (it prints each code instead of
   emailing it).
3. Enter the code to unlock the terminal. Your session is stored in
   `localStorage`; use **Logout** in the header to end it.

### Pointing at a real backend

Set the backend URL (copy `.env.example` to `.env.local`):

```bash
NEXT_PUBLIC_UPCOME_API_URL=https://api.your-upcome-host.io
```

> `NEXT_PUBLIC_*` values are inlined at build time — set it before `npm run build`.

If the event stream can't be reached after a few attempts, the terminal drops
into a built-in **demo feed** (generated in the browser) so it's never blank —
the status pill in the header shows `DEMO FEED` when that happens.

## Using the terminal

- **Open a column** — type a topic in the command line (`UPCOME>`) and press
  **GO** / Enter, or click a quick-add chip. The chips are a curated shortlist
  of common symbols; any other topic can be opened by typing it in.
- **Close a column** — the `×` in a column header. The **WORLD** column is
  pinned and can't be closed.
- **Open a story** — hover a row and click `more-info ↗`.
- Your column layout is saved to `localStorage` and restored on reload.

The header shows connection state and a live UTC clock; the footer shows the
feed URL, column/event counts, and time since the last message.

## Project layout

```
server/mock-backend.mjs     Mock Upcome backend (Auth API + events websocket)
src/app/                    App Router entry, layout, global theme
src/components/
  AuthGate.tsx              Shows the login screen until authenticated
  LoginScreen.tsx           Email → code passwordless login flow
  Terminal.tsx              Orchestrates columns, state, and the feed
  TopBar.tsx / StatusBar.tsx  Header + footer chrome (+ user / logout)
  CommandBar.tsx            Bloomberg-style command line + quick-add
  Column.tsx / EventRow.tsx Per-topic feed column and rows
src/lib/
  api.ts                    Backend client: login, session (JWT), interests
  auth.tsx                  Auth context + persisted session (useAuth)
  types.ts                  Wire + internal types, event normalization
  useUpcomeSocket.ts        Authenticated feed: interests, reconnect, demo
  useNotificationSound.ts   Synthesised terminal alert chime + mute toggle
  mockEvents.ts             Headline catalog for the in-browser demo feed
```

## Production build

```bash
npm run build
npm run start
```
