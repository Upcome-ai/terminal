# Auth API

The API runs at `http://localhost:7070` by default. Set the `PORT` environment variable to use a different port.

Requests and responses use JSON. Protected HTTP endpoints require this header:

```http
Authorization: Bearer <jwt>
```

## Request a login code

`POST /auth/login-code`

Sends a login code to the supplied email address.

Request:

```json
{
  "email": "user@example.com"
}
```

Success — `202 Accepted`:

```json
{
  "message": "Login code sent"
}
```

Errors:

- `400 Bad Request` — the email is missing or invalid.
- `503 Service Unavailable` — the login code could not be sent.

## Create a session

`POST /auth/session`

Exchanges an emailed login code for a JWT.

Request:

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Success — `200 OK`:

```json
{
  "jwt": "<jwt>",
  "tokenType": "Bearer"
}
```

Errors:

- `400 Bad Request` — the email or code is missing.
- `401 Unauthorized` — the login code is invalid or expired.

## Get user interests

`GET /user/interests`

Returns the authenticated user's topics and WebSocket path.

Success — `200 OK`:

```json
{
  "interests": ["AAPL", "MSFT"],
  "websocketPath": "/user/events"
}
```

Error:

- `401 Unauthorized` — the bearer token is missing, invalid, or expired.

## Add a user interest

`POST /user/interests`

Adds a topic to the authenticated user's interests. Topics are converted to uppercase and may contain letters, numbers, `.`, `_`, and `-`, with a maximum length of 50 characters.

Request:

```json
{
  "topic": "aapl"
}
```

Success — `200 OK`:

```json
{
  "topic": "AAPL",
  "added": true,
  "interests": ["AAPL"],
  "websocketPath": "/user/events",
  "websocketTokenQueryParameter": "sessionToken"
}
```

Errors:

- `400 Bad Request` — the topic is missing or invalid.
- `401 Unauthorized` — the bearer token is missing, invalid, or expired.

## Subscribe to user events

`WebSocket /user/events?sessionToken=<jwt>`

Opens a WebSocket connection for events matching the user's interests. The JWT is passed in the `sessionToken` query parameter.

The server sends this message when the connection is ready:

```json
{
  "type": "connection.ready",
  "interests": ["AAPL"]
}
```

Topic events use this format:

```json
{
  "topic": "AAPL",
  "event": "Event summary",
  "more-info": "https://example.com/details"
}
```

If the JWT is missing, invalid, or expired, the server closes the connection with WebSocket code `1008`.
