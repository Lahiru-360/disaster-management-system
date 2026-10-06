# Disaster Management System API Contract

**Purpose:** the single source of truth for how every endpoint in this project looks — the shape of a request, the shape of a response, and what each status code means here. Client code is written against this document, not against whichever server behavior happens to exist yet. If a real endpoint disagrees with this document, the endpoint is wrong.

This contract covers the auth (§5), upload (§6), areas (§7), hazard events (§8), hazard reports (§9), organisations (§10), notifications (§11), hazard alerts (§12) and coordination (§13) endpoints in full, **frozen at `contract-freeze-1`** (DMS-112). Post-event reports (§14) follow in their own PR. New endpoints are added under these same conventions — they get their own sections when specified, not their own rules — and a frozen endpoint changes only as §15 describes.

---

## 1. Base URL and routing conventions

- All endpoints are mounted under `/api`.
- Resources are **plural, lowercase, hyphenated**: `/api/uploads`, `/api/items`, `/api/item-categories`.
- Auth is not a CRUD resource, so its routes are actions under `/api/auth/<action>`: `/api/auth/register`, `/api/auth/login`.
- Nesting reflects ownership, not just relation, e.g. `/api/items/:itemId/comments`.

### HTTP methods

| Method | Meaning |
|---|---|
| `GET` | Retrieve one resource or a collection. Never changes state. |
| `POST` | Create a new resource, or perform an action that isn't a resource CRUD op (`login`, `refresh`, `logout`). |
| `PUT` | Replace a resource in full. |
| `PATCH` | Update part of a resource. |
| `DELETE` | Remove a resource. |

### Locations

A point is `{ lat, lng }` in decimal degrees (WGS 84), with an optional `label` where a place name is shown (§7, §13). Hazard reports (§9) are the one exception: their `location` is `{ latitude, longitude }`, as frozen with UC02's merged model. Read each section's field table rather than assuming.

### A record outside the caller's scope

A record the caller may not see — in another district, or belonging to another user — is answered in one of two ways, and each section says which:

- `404 NOT_FOUND` where the record's existence is itself private: a citizen's hazard report (§9), another user's inbox item (§11). The same answer as an unknown id, so nothing is revealed.
- `403 FORBIDDEN` where it isn't: coordination records (§13), whose district is not a secret.

---

## 2. Success response envelope

Every successful response — regardless of endpoint — returns the same outer shape. The payload lives under `data`.

```json
{
  "success": true,
  "data": { }
}
```

`data` holds whatever is appropriate to the endpoint: an object, an array, or `null` for actions with nothing to return (e.g. logout).

**Example** — `GET /api/auth/me`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nimal Perera",
      "email": "citizen@example.test",
      "role": "citizen",
      "createdAt": "2026-08-01T09:15:00.000Z"
    }
  }
}
```

---

## 3. Error response envelope

Every error response — regardless of cause — returns the same outer shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "email", "message": "must be a valid email address" }
    ]
  }
}
```

- `code` — a fixed, machine-readable string the client can branch on (e.g. show a specific message, redirect to login). Not the HTTP status text — a project-specific code.
- `message` — a human-readable summary, safe to show in a toast if no field-level detail applies.
- `errors` — **optional**. Present only for field-level validation failures (`400`). An array of `{ field, message }`, one entry per invalid field. Omitted entirely for errors that aren't about field validation (auth failures, not-found, conflicts, server errors).

### Error codes in use

| Code | Used for |
|---|---|
| `VALIDATION_ERROR` | Request body/params/query failed schema validation. |
| `INVALID_CREDENTIALS` | Login email/password combination doesn't match. |
| `ACCOUNT_DEACTIVATED` | `POST /api/auth/login` with correct credentials for a deactivated account (§5.2). Always `403`, and deliberately distinguishable from `INVALID_CREDENTIALS` — the caller has already proven they hold the right credentials. `requireAuth` refuses a deactivated user's still-valid access token too (§5.8), but reuses `TOKEN_INVALID` for that rather than this code. |
| `INVALID_CURRENT_PASSWORD` | `POST /api/auth/change-password` called with a `currentPassword` that doesn't match the stored hash. Always `401`, distinguishable from `TOKEN_EXPIRED`/`TOKEN_INVALID` so the client shows a field error instead of re-authenticating. |
| `PASSWORD_UNCHANGED` | `POST /api/auth/change-password` called with a `newPassword` identical to the current password. Always `400`. |
| `RESET_TOKEN_INVALID` | `POST /api/auth/reset-password` (§5.10) with a token that's expired, already used, unknown or malformed. Always `400`, and deliberately the same code and message for all four cases — distinguishing them would tell an attacker holding a stale token which state it's in. |
| `EMAIL_ALREADY_EXISTS` | Register called with an email already in the database. |
| `UNAUTHENTICATED` | Reached a role check with no authenticated user. |
| `AUTH_HEADER_MISSING` | No `Authorization` header on a request that requires one. |
| `AUTH_HEADER_MALFORMED` | `Authorization` header present but not `Bearer <token>`. |
| `TOKEN_EXPIRED` | Access or refresh token is well-formed but expired. |
| `TOKEN_INVALID` | Access token is invalid, or a refresh token doesn't match a known, unrevoked token. |
| `FORBIDDEN` | Authenticated, but the user's role isn't allowed to do this. |
| `NOT_FOUND` | The requested resource doesn't exist. |
| `INTERNAL_ERROR` | Unhandled server-side failure. |
| `FILE_MISSING` | An upload request had no file in the fixed field name. |
| `UNSUPPORTED_FILE_TYPE` | An uploaded file's MIME type isn't PNG, JPG or PDF. |
| `FILE_TYPE_MISMATCH` | An uploaded file's extension doesn't match its reported MIME type. |
| `FILE_TOO_LARGE` | An uploaded file exceeds the 5MB limit. |
| `STORAGE_UNAVAILABLE` | The storage backend (Supabase) failed or was unreachable. Always `502`. |
| `EMAIL_UNAVAILABLE` | The transactional email provider failed or was unreachable while sending. Always `502`. |
| `REPORT_ALREADY_REVIEWED` | Confirm or dismiss on a hazard report that is no longer `PENDING` (§9.6–9.7). Always `409`; the message names the current status. |
| `INVALID_ALERT_TRANSITION` | An action a hazard alert's current status doesn't allow, e.g. previewing, editing or broadcasting an alert that is no longer `DRAFT` (§12.3–12.4, §12.6). Always `409`; the message names the current status. |
| `NO_RECIPIENTS_IN_SCOPE` | Broadcasting a hazard alert whose scope holds no registered citizens (§12.6, UC01 E2). Always `409`; nothing is sent and the alert stays `DRAFT`. |
| `NO_ACTIVE_INCIDENT` | A UC03 officer write while the district has no `ACTIVE` hazard event (§13.1). Always `409`. |
| `SHELTER_NAME_TAKEN` | Registering a shelter whose name, ignoring case and surrounding spaces, is already used in the district (§13.4.3). Always `409`. |
| `SHELTER_NO_SPACE` | Redirecting arrivals to a shelter that has no spare capacity (§13.4.4). Always `409`. |
| `TEAM_NOT_AVAILABLE` | Dispatching or assigning a rescue team that isn't `AVAILABLE`, e.g. another officer dispatched it first (§13.7.2, §13.9.2). Always `409`. |
| `INVALID_DISPATCH_TRANSITION` | A dispatch action its current status doesn't allow, e.g. completing an `ASSIGNED` dispatch or acknowledging after the deadline (§13.2). Always `409`. |
| `INVALID_TEAM_TRANSITION` | Marking a rescue team available while it is `DISPATCHED` or `ON_SITE` (§13.10.1). Always `409`. |

New codes may be added for new resources; existing codes are never repurposed for a different meaning.

---

## 4. Status codes in use

| Status | Meaning in this project |
|---|---|
| `200 OK` | Request succeeded. Used for `GET`, `PUT`, `PATCH`, `DELETE`, and action-style `POST`s that don't create a resource (`login`, `refresh`, `logout`). |
| `201 Created` | A new resource was created. Used for `register` and every resource-creating `POST`. |
| `400 Bad Request` | Validation failed — the request body/params/query didn't match the expected shape. Always carries `errors`. |
| `401 Unauthorized` | Not authenticated: missing/invalid/expired token, or (for login) wrong credentials. |
| `403 Forbidden` | Authenticated, but the user's role doesn't permit this action. |
| `404 Not Found` | The resource, or the route, doesn't exist. |
| `409 Conflict` | The request conflicts with existing state — e.g. registering an email that's already taken. |
| `500 Internal Server Error` | Unhandled failure on the server. Never leaks stack traces or internals to the client in production. |
| `502 Bad Gateway` | A dependency the server calls out to (e.g. Supabase Storage) failed or was unreachable. Distinguishes "the thing you sent was fine but our infrastructure isn't" from a `400`/`500`. |

---

## 5. Auth endpoints

All request/response bodies below are the JSON that goes inside the envelopes from sections 2 and 3 — i.e. a success example shows what fills `data`, and a failure example shows what fills `error`.

Tokens: `accessToken` is short-lived and sent in `Authorization: Bearer <token>` on subsequent requests. `refreshToken` is longer-lived, stored in `expo-secure-store` client-side, and used only against `/api/auth/refresh`. The officer web portal (`web/`) keeps both tokens in `localStorage` instead.

### 5.1 Register — `POST /api/auth/register`

Creates a new user account.

**Request body**

```json
{
  "name": "Nimal Perera",
  "email": "citizen@example.test",
  "password": "Password123!",
  "role": "citizen"
}
```

`name` is required: trimmed, at most 100 characters.

`role` must be one of the self-registrable roles, `"citizen"` or `"community_volunteer"`. Any other value — including the four seeded roles below — fails with `400 VALIDATION_ERROR` on `role`. Seeded accounts are created only by the seed script or by direct database access — see `server/README.md`.

| Role | Created by | Client |
|---|---|---|
| `citizen` | This endpoint | Mobile app |
| `community_volunteer` — a kind of citizen | This endpoint | Mobile app |
| `rescue_team_lead` | Seed script | Mobile app |
| `dmc_officer` | Seed script | Web portal |
| `duty_officer` — a kind of DMC officer | Seed script | Web portal |
| `district_officer` | Seed script | Web portal |

The API doesn't check which client a request comes from — the Client column is where each role is meant to sign in. The mobile app stops officer roles, and any role it doesn't know, at a wrong-platform screen.

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nimal Perera",
      "email": "citizen@example.test",
      "role": "citizen",
      "createdAt": "2026-08-01T09:15:00.000Z"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8f14e45fceea167a5a36..."
  }
}
```

**Failure — `400 Bad Request`** (validation, e.g. missing password or invalid email)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "password", "message": "must be at least 8 characters" }
    ]
  }
}
```

**Failure — `409 Conflict`** (duplicate email)

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "An account with this email already exists."
  }
}
```

### 5.2 Login — `POST /api/auth/login`

**Request body**

```json
{
  "email": "citizen@example.test",
  "password": "Password123!"
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nimal Perera",
      "email": "citizen@example.test",
      "role": "citizen",
      "createdAt": "2026-08-01T09:15:00.000Z"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8f14e45fceea167a5a36..."
  }
}
```

**Failure — `401 Unauthorized`** (wrong password, or email not found — same response either way, so the client can't enumerate accounts)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect."
  }
}
```

**Failure — `403 Forbidden`** (correct credentials, but the account has been deactivated — deliberately distinguishable from a wrong password, since the enumeration rule above only protects unknown accounts)

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_DEACTIVATED",
    "message": "This account has been deactivated."
  }
}
```

### 5.3 Refresh — `POST /api/auth/refresh`

Exchanges a valid refresh token for a new access/refresh pair (rotation — the old refresh token is revoked).

**Request body**

```json
{
  "refreshToken": "8f14e45fceea167a5a36..."
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "3a5f8c1d9b2e04f6..."
  }
}
```

**Failure — `401 Unauthorized`** (expired)

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Refresh token has expired. Please log in again."
  }
}
```

**Failure — `401 Unauthorized`** (unknown or already-revoked token)

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Refresh token is invalid."
  }
}
```

### 5.4 Logout — `POST /api/auth/logout`

Revokes a refresh token so it can no longer be used. Requires a valid access token (`Authorization: Bearer <accessToken>`).

**Request body**

```json
{
  "refreshToken": "8f14e45fceea167a5a36..."
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": null
}
```

**Failure — `401 Unauthorized`** (no/invalid/expired access token)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "You must be logged in to do this."
  }
}
```

### 5.5 Current user — `GET /api/auth/me`

Returns the authenticated user. Requires `Authorization: Bearer <accessToken>`.

**Request body:** none.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Nimal Perera",
      "email": "citizen@example.test",
      "role": "citizen",
      "createdAt": "2026-08-01T09:15:00.000Z"
    }
  }
}
```

### 5.6 Change password — `POST /api/auth/change-password`

Changes the authenticated user's password. Requires `Authorization: Bearer <accessToken>`.

On success, every refresh token belonging to the user is revoked and a fresh access/refresh pair is issued — the caller stays signed in on this device with the returned pair; every other device is signed out at its next `/api/auth/refresh` call.

**Request body**

```json
{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword456!"
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "3a5f8c1d9b2e04f6..."
  }
}
```

**Failure — `401 Unauthorized`** (no/invalid/expired access token — same codes as §5.5)

**Failure — `401 Unauthorized`** (`currentPassword` doesn't match the stored hash)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CURRENT_PASSWORD",
    "message": "Current password is incorrect."
  }
}
```

**Failure — `400 Bad Request`** (`newPassword` shorter than the minimum registration enforces)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "newPassword", "message": "must be at least 8 characters" }
    ]
  }
}
```

**Failure — `400 Bad Request`** (`newPassword` identical to `currentPassword`)

```json
{
  "success": false,
  "error": {
    "code": "PASSWORD_UNCHANGED",
    "message": "New password must be different from your current password."
  }
}
```

**Failure — `401 Unauthorized`** (no/invalid/expired access token)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "You must be logged in to do this."
  }
}
```

### 5.7 Deactivate account — `POST /api/auth/deactivate`

Deactivates the authenticated caller's own account. Requires `Authorization: Bearer <accessToken>`. There is no request body and no id parameter — a caller can only ever deactivate their own account.

Sets `isActive` to `false` and revokes every refresh token belonging to the user, signing every device out immediately — there is no session to preserve, unlike §5.6, because the account is going away. Deactivation never deletes anything: the user's existing data is left exactly as it is, and nothing is anonymised.

**Request body:** none.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": null
}
```

**Failure — `401 Unauthorized`** (no/invalid/expired access token — same codes as §5.5)

### 5.8 Authentication middleware

`server/src/middleware/AuthMiddleware.js` provides three middleware, as methods of its shared `authMiddleware` instance:

- **`requireAuth`** — rejects. No token, a malformed header, an expired token, an invalid/tampered token, a token whose user no longer exists, or a token whose user has since been deactivated each 401 with one of `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`. The deactivated case reuses `TOKEN_INVALID` rather than `ACCOUNT_DEACTIVATED` (§3) — that code is reserved for the login refusal (§5.2), and the user is reloaded from the database rather than trusted from the token's claim so this catches an access token minted before deactivation and still inside its expiry window. A valid token loads the user from the database and sets `req.user`. Used on every endpoint that requires a signed-in caller.
- **`optionalAuth`** — never rejects. A valid token sets `req.user` exactly as `requireAuth` does. Every other case — no header, a malformed header, an expired token, an invalid/tampered token, or a token whose user no longer exists — leaves `req.user` undefined and calls `next()` with no error. For a public endpoint that wants to know who's asking without requiring anyone to be. No endpoint uses it yet; `server/tests/integration/auth.optional.test.js` covers it on a probe route.
- **`requireRole(...roles)`** — placed after `requireAuth` or `optionalAuth`. Admits a listed role and every role that inherits from one: `requireRole('citizen')` also admits a `community_volunteer`, and `requireRole('dmc_officer')` also admits a `duty_officer` — never the other way round. Fails closed: `401 UNAUTHENTICATED` if `req.user` is absent, `403 FORBIDDEN` if the user's role is neither listed nor inherits from a listed role (including a role the server no longer knows). An unknown role name passed to `requireRole` throws when the route is declared.

### 5.9 Forgot password — `POST /api/auth/forgot-password`

Requests a password reset link for the given email. No `Authorization` header — a locked-out user has none.

**Always returns `200` with the same body** whether the address matches an active account, a deactivated account, or no account at all — the same anti-enumeration rule login already follows (§5.2). When the address matches an active account, a reset email is sent through the transactional email provider carrying a single-use link that expires after **thirty minutes**. A deactivated account receives no email — deactivation means the account cannot be signed into, and a reset must not be a way around that. Requesting again before an earlier link is used invalidates it, so only the most recent link for an account ever works.

**Request body**

```json
{
  "email": "citizen@example.test"
}
```

**Success — `200 OK`** (identical regardless of whether the address matches an account)

```json
{
  "success": true,
  "data": {
    "message": "If that email is registered, a password reset link has been sent."
  }
}
```

**Failure — `400 Bad Request`** (`email` missing or not a valid address)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "email", "message": "must be a valid email" }
    ]
  }
}
```

### 5.10 Reset password — `POST /api/auth/reset-password`

Sets a new password from a reset link's token. No `Authorization` header — the person resetting isn't signed in anywhere.

On success, marks the token used, sets the new password, and revokes **every** refresh token belonging to the account — not every other, unlike §5.6, because there is no acting session here to preserve. Returns a success envelope only; it does not sign the caller in or issue a token pair, the client routes to Login.

An expired, already-used, unknown or malformed token all return the same `400 RESET_TOKEN_INVALID` refusal with the same message — distinguishing "expired" from "already used" would tell an attacker holding a stale token which state it's in, and the user's remedy is identical either way: request a new link.

**Request body**

```json
{
  "token": "3f9a1c7e2b...",
  "newPassword": "NewPassword456!"
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": null
}
```

**Failure — `400 Bad Request`** (token expired, already used, unknown or malformed)

```json
{
  "success": false,
  "error": {
    "code": "RESET_TOKEN_INVALID",
    "message": "This reset link is invalid or has expired. Request a new one."
  }
}
```

**Failure — `400 Bad Request`** (`newPassword` shorter than the minimum registration enforces)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "newPassword", "message": "must be at least 8 characters" }
    ]
  }
}
```

---

## 6. Upload endpoint

Stores a file in Supabase Storage and returns its public URL. The client never talks to Supabase directly, only to this endpoint.

### 6.1 Upload a file — `POST /api/uploads`

**Request:** `multipart/form-data`, not JSON.

| Field | Rule |
|---|---|
| `file` | **Required.** The file itself. PNG, JPG or PDF only, checked against both its MIME type and its extension. Max 5MB. |
| `folder` | **Required.** A closed list of purposes, not a free path — a caller can't write anywhere else in the bucket. Currently `avatars` (profile pictures) and `hazard-reports` (UC02 hazard report photos); a feature that needs another purpose adds it to the list. Every folder shares the same 5MB cap and PNG/JPG/PDF allow-list, whatever the calling screen further restricts client-side. |

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "url": "https://<project>.supabase.co/storage/v1/object/public/<bucket>/avatars/9b1e3f2a-....png"
  }
}
```

The returned name is generated server-side and unguessable — never the filename the client sent, and never derived from the caller's user id.

**Failure — `400 Bad Request`** (bad `folder`, same shape as any other `VALIDATION_ERROR`):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "folder", "message": "must be one of [avatars, hazard-reports]" }
    ]
  }
}
```

**Failure — `400 Bad Request`** (no file in the `file` field):

```json
{
  "success": false,
  "error": {
    "code": "FILE_MISSING",
    "message": "No file was provided."
  }
}
```

**Failure — `400 Bad Request`** (wrong type, mismatched extension, or oversize) — see 6.2 for the three distinct codes.

**Failure — `401 Unauthorized`** — no, malformed, expired or invalid access token; see 6.2 for the codes. Guests cannot upload.

**Failure — `502 Bad Gateway`** (Supabase is down or rejects the request):

```json
{
  "success": false,
  "error": {
    "code": "STORAGE_UNAVAILABLE",
    "message": "Could not upload the file. Please try again."
  }
}
```

A `502` means the file itself may have been fine — try again. A `400` means the file or request was the problem — retrying unchanged won't help.

### 6.2 Error codes for this endpoint

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `folder` missing or not in the closed list (`avatars`, `hazard-reports`). Carries `errors`. |
| `400` | `FILE_MISSING` | No file in the `file` field. |
| `400` | `UNSUPPORTED_FILE_TYPE` | File's MIME type isn't PNG, JPG or PDF. |
| `400` | `FILE_TYPE_MISMATCH` | File's extension doesn't match its reported MIME type — catches a renamed file. |
| `400` | `FILE_TOO_LARGE` | File exceeds 5MB. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists. |
| `502` | `STORAGE_UNAVAILABLE` | Supabase failed or was unreachable. The request may have been valid — safe to retry. |

---

## 7. Areas endpoints

The registered geography every feature works "by district" against: the 25 districts of Sri Lanka and the river basins that span them. A district and a river basin are both a **target area** — the thing a hazard warning is aimed at — so every other section refers to them by the `id` these endpoints return (`areaIds`, `districtId`, `districtIds`). No other section defines its own list of districts.

Both endpoints are read-only reference data, seeded by `npm run seed` and never edited through the API. Both require `Authorization: Bearer <accessToken>`, and admit **every role** — citizens need the district list as much as officers do.

**Request:** no body and no query parameters. The full list is always returned, sorted by `name` ascending, without pagination.

`bounds` is a bounding box, not the district's real outline — an accepted approximation that is only used to work out which district a point falls in. `centroid` is the reference point for distance calculations.

### 7.1 List districts — `GET /api/districts`

**Success — `200 OK`** (two of the 25 districts shown)

```json
{
  "success": true,
  "data": {
    "districts": [
      {
        "id": "66f7c1a2b3c4d5e6f7a8b901",
        "name": "Colombo",
        "province": "Western",
        "centroid": { "lat": 6.9271, "lng": 79.8612 },
        "bounds": { "minLat": 6.75, "maxLat": 6.98, "minLng": 79.83, "maxLng": 80.22 },
        "createdAt": "2026-09-28T08:00:00.000Z",
        "updatedAt": "2026-09-28T08:00:00.000Z"
      },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b902",
        "name": "Gampaha",
        "province": "Western",
        "centroid": { "lat": 7.0917, "lng": 79.9999 },
        "bounds": { "minLat": 6.98, "maxLat": 7.33, "minLng": 79.82, "maxLng": 80.26 },
        "createdAt": "2026-09-28T08:00:00.000Z",
        "updatedAt": "2026-09-28T08:00:00.000Z"
      }
    ]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The district's id. Use this, never `name`, to refer to a district in any request. |
| `name` | string | Unique, e.g. `"Colombo"`. |
| `province` | string | The province it belongs to, e.g. `"Western"`. |
| `centroid` | `{ lat, lng }` | Decimal degrees (WGS 84). |
| `bounds` | `{ minLat, maxLat, minLng, maxLng }` | Decimal degrees (WGS 84). |
| `createdAt`, `updatedAt` | ISO 8601 string | |

### 7.2 List river basins — `GET /api/river-basins`

**Success — `200 OK`** (one basin shown)

```json
{
  "success": true,
  "data": {
    "riverBasins": [
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9a1",
        "name": "Kelani",
        "districts": [
          { "id": "66f7c1a2b3c4d5e6f7a8b901", "name": "Colombo" },
          { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" }
        ],
        "createdAt": "2026-09-28T08:00:00.000Z",
        "updatedAt": "2026-09-28T08:00:00.000Z"
      }
    ]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The basin's id. A basin id is accepted wherever a request takes target areas (`areaIds`), and stands for every district it spans. |
| `name` | string | Unique, e.g. `"Kelani"`. |
| `districts` | `[{ id, name }]` | The districts the basin spans, at least one, sorted by `name`. Each `id` is a district id from §7.1, so a client can show "Kelani (Colombo, Gampaha)" without a second request. |
| `createdAt`, `updatedAt` | ISO 8601 string | |

### 7.3 Error codes for these endpoints

Neither endpoint takes input, so neither can fail validation, and an empty list is `200` with `[]`, not `404`.

| Status | Code | When |
|---|---|---|
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure, e.g. the database is unreachable. |

**Failure — `401 Unauthorized`** (no `Authorization` header)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_HEADER_MISSING",
    "message": "Authorization header is missing."
  }
}
```

---
## 8. Hazard events endpoints

A **hazard event** is the incident other sections group their records under: UC03's coordination dashboard opens against the one `ACTIVE` event for a district, and UC04's post-event report is generated from one `CLOSED` event. Both read the same record — there is no separate "incident" concept.

Both endpoints are read-only reference data, seeded by `npm run seed`. `hazardType` reuses UC01's `AlertHazardType` enum (`FLOOD`, `LANDSLIDE`, `CYCLONE`, `DROUGHT`). A district has **at most one `ACTIVE` event at a time**: UC03's dashboard and UC01's alerts both look up "the" active event for a district. Opening and closing an event is seed-only in this phase — no endpoint here creates, updates or closes one.

### 8.1 List hazard events — `GET /api/hazard-events`

Requires `Authorization: Bearer <accessToken>`. Admits every role.

**Request:** no body.

| Query param | Rule |
|---|---|
| `status` | Optional. One of `ACTIVE`, `CLOSED`. Any other value → `400 VALIDATION_ERROR` on `status`. |
| `districtId` | Optional. A district id from §7.1. Matches an event whose `districts` includes it. A malformed id (not a valid id shape) → `400 VALIDATION_ERROR` on `districtId`; a well-formed but unknown id returns an empty list, not an error. |

With neither param, every event is returned.

**Success — `200 OK`** (sorted by `startDate` descending — most recent first)

```json
{
  "success": true,
  "data": {
    "hazardEvents": [
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9c1",
        "name": "Flood – Gampaha District",
        "hazardType": "FLOOD",
        "status": "ACTIVE",
        "startDate": "2026-09-25T00:00:00.000Z",
        "endDate": null,
        "districts": [{ "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" }],
        "createdAt": "2026-09-28T08:00:00.000Z",
        "updatedAt": "2026-09-28T08:00:00.000Z"
      },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9c2",
        "name": "Kelani basin floods",
        "hazardType": "FLOOD",
        "status": "CLOSED",
        "startDate": "2026-06-08T00:00:00.000Z",
        "endDate": "2026-06-20T00:00:00.000Z",
        "districts": [
          { "id": "66f7c1a2b3c4d5e6f7a8b901", "name": "Colombo" },
          { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
          { "id": "66f7c1a2b3c4d5e6f7a8b903", "name": "Kalutara" }
        ],
        "createdAt": "2026-09-28T08:00:00.000Z",
        "updatedAt": "2026-09-28T08:00:00.000Z"
      }
    ]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The event's id. UC04 reads a report for one event at a time by this id. |
| `name` | string | e.g. `"Kelani basin floods"`. |
| `hazardType` | string | One of `AlertHazardType` — see the provisional note above. |
| `status` | string | `ACTIVE` or `CLOSED`. |
| `startDate`, `endDate` | ISO 8601 string or `null` | `endDate` is `null` while `status` is `ACTIVE`. |
| `districts` | `[{ id, name }]` | The districts this event affects, each `id` a district id from §7.1. |
| `createdAt`, `updatedAt` | ISO 8601 string | |

**Failure — `400 Bad Request`** (unknown `status` value)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "status", "message": "must be one of [ACTIVE, CLOSED]" }]
  }
}
```

**Failure — `401 Unauthorized`** — as in §7.3.

### 8.2 Error codes for this endpoint

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `status` is not `ACTIVE` or `CLOSED`, or `districtId` is not a valid id. Carries `errors`. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

---

## 9. Hazard reports endpoints

UC02 Submit and Verify Hazard Report. A **citizen** or **community volunteer** submits a ground report from the mobile app; the **duty officer** for the report's district reviews it in the web console and confirms or dismisses it. Only a confirmed report can be escalated to a warning, and that escalation is UC01's (A1), not an endpoint here — confirming never creates a hazard alert or changes a warning level.

Every endpoint requires `Authorization: Bearer <accessToken>`. Roles follow the server's role inheritance:

| Endpoints | Roles admitted | Everyone else |
|---|---|---|
| Submit (9.2), my reports (9.3) | `citizen`, `community_volunteer` (a volunteer is a citizen) | `403 FORBIDDEN` |
| Queue (9.4), detail (9.5), confirm (9.6), dismiss (9.7) | `duty_officer` only — the verification privilege. `dmc_officer` and `district_officer` don't have it. | `403 FORBIDDEN` |
| Place search (9.8) | Every role, like the areas endpoints in §7 | — |

**District scoping:** a duty officer only ever sees reports in their own `shiftDistrict`. A report in another district — or an `:id` that is unknown or not a valid id — is `404 NOT_FOUND`, so its existence isn't revealed.

### 9.1 The report object

Every endpoint below that returns a report returns this shape.

```json
{
  "id": "66f9a0c1b2c3d4e5f6a7b801",
  "referenceNo": "GR-2481",
  "hazardType": "RISING_RIVER_FLOOD",
  "description": "Water level rising near the bridge",
  "photoUrl": "https://<project>.supabase.co/storage/v1/object/public/<bucket>/hazard-reports/3c9d1e7a-....jpg",
  "location": { "latitude": 6.9382, "longitude": 79.9012 },
  "locationSource": "GPS",
  "district": { "id": "66f7c1a2b3c4d5e6f7a8b901", "name": "Colombo" },
  "reporter": { "id": "64f1a2b3c4d5e6f7a8b9c0d1", "role": "citizen" },
  "status": "PENDING",
  "isEscalatable": false,
  "clusterId": "66f9a0c1b2c3d4e5f6a7b801",
  "submittedAt": "2026-10-02T04:54:00.000Z",
  "reviewedBy": null,
  "reviewedAt": null,
  "dismissalReason": null,
  "dismissalNote": null,
  "clientReportId": "b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The report's id. |
| `referenceNo` | string | `GR-` plus a zero-padded number, unique and assigned by the server, e.g. `"GR-2481"`. This is what the reporter and the officer see. |
| `hazardType` | enum | `RISING_RIVER_FLOOD`, `LANDSLIDE`, `BLOCKED_ROAD`, `OTHER` (`ReportHazardType`). Shown as _Rising river / Flood_, _Landslide_, _Blocked road_, _Other_. Not the same list as UC01's alert hazard types. |
| `description` | string | 1–200 characters. |
| `photoUrl` | string | A URL returned by `POST /api/uploads` with `folder=hazard-reports` (§6). |
| `location` | `{ latitude, longitude }` | Decimal degrees (WGS 84), inside Sri Lanka (see 9.2). |
| `locationSource` | enum | `GPS` (the device's position) or `MANUAL` (set by the reporter when GPS was unavailable). Shown to the officer after the coordinates. |
| `district` | `{ id, name }` | The district (§7) the location falls in, or the reporter's home district when the point matches none. Set by the server. |
| `reporter` | `{ id, role }` | Who submitted it. Officers never get the reporter's name or contact details. |
| `status` | enum | `PENDING` → `CONFIRMED` or `DISMISSED` (`ReportStatus`). Both reviewed states are final. |
| `isEscalatable` | boolean | `true` only when `CONFIRMED`. UC01 reads this before escalating. |
| `clusterId` | string | Reports of the same situation share one. A report that matched no earlier report starts its own cluster, so `clusterId` equals its own `id`. |
| `submittedAt` | ISO 8601 string | Set by the server. |
| `reviewedBy` | `{ id, name }` or `null` | The duty officer who confirmed or dismissed it. |
| `reviewedAt` | ISO 8601 string or `null` |  |
| `dismissalReason` | enum or `null` | `INACCURATE`, `DUPLICATE`, `NOT_A_HAZARD`, `INSUFFICIENT_EVIDENCE` (`DismissalReason`). Set only when `DISMISSED`. |
| `dismissalNote` | string or `null` | Up to 200 characters. Only when `DISMISSED`. |
| `clientReportId` | string or `null` | The UUID the app generated, when it sent one (9.2). |

### 9.2 Submit a report — `POST /api/hazard-reports`

UC02 main flow steps 5–9. The app uploads the photo first (§6), then sends its URL here.

**Roles:** `citizen`, `community_volunteer`.

**Request**

```json
{
  "description": "Water level rising near the bridge",
  "hazardType": "RISING_RIVER_FLOOD",
  "location": { "latitude": 6.9382, "longitude": 79.9012 },
  "locationSource": "GPS",
  "photoUrl": "https://<project>.supabase.co/storage/v1/object/public/<bucket>/hazard-reports/3c9d1e7a-....jpg",
  "clientReportId": "b4f0c9e2-6a1d-4c7e-9f3a-2d8e5b7a1c60"
}
```

| Field | Rule |
|---|---|
| `description` | **Required.** 1–200 characters after trimming. |
| `hazardType` | **Required.** One of the `hazardType` values in 9.1. |
| `location` | **Required.** `latitude` and `longitude` are both required numbers, and the point must be inside Sri Lanka: latitude 5.85–9.90 and longitude 79.50–81.95, edges included. This box is an approximation of the coastline. |
| `locationSource` | **Required.** `GPS` or `MANUAL`. |
| `photoUrl` | **Required.** A URI. |
| `clientReportId` | Optional. A UUID v4 the app generates once per report, so a report sent again after a dropped connection isn't stored twice. |

The server then:

1. Looks for a **PENDING** report of the **same hazard type**, within **500 m**, submitted in the last **2 hours**. If it finds one, the new report joins that report's cluster (the oldest match's, when several match). It is never discarded — it still gets its own reference.
2. Stores the report as `PENDING` with a new `referenceNo`, and derives `district` from the location.
3. Notifies the on-shift duty officers of that district (9.10).

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "66f9a0c1b2c3d4e5f6a7b801",
      "referenceNo": "GR-2481",
      "status": "PENDING",
      "...": "the full report object from 9.1"
    }
  }
}
```

**Success — `200 OK`** (resend: the caller already submitted a report with this `clientReportId`)

The existing report is returned, unchanged, in the same shape as `201`. Nothing new is stored and nobody is notified again — even if two copies arrive at the same moment, exactly one report exists afterwards.

**Failure — `400 Bad Request`** (one entry per invalid field)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "photoUrl", "message": "is required" },
      { "field": "location", "message": "must be inside Sri Lanka" },
      { "field": "description", "message": "must be at most 200 characters" }
    ]
  }
}
```

The `field` is always the top-level request field — `location` for a missing, malformed or out-of-country point, not `location.latitude` — so the app can highlight it directly.

A point inside the box that falls in no district (far offshore), sent by a reporter with no home district on file, can't be routed to any duty officer, so it is refused the same way: `{ "field": "location", "message": "must be inside a district of Sri Lanka" }`.

**Failure — `403 Forbidden`** (an officer or rescue team lead)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

**Failure — `401 Unauthorized`** — see 9.9.

Checked by TC-01–TC-08, TC-20, TC-21, TC-23–TC-37.

### 9.3 My reports — `GET /api/hazard-reports/mine`

The reporter's own reports, for the app's _My reports_ tab. Every status is included, newest first, without pagination. Another user's reports never appear.

**Roles:** `citizen`, `community_volunteer`.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "66f9a0c1b2c3d4e5f6a7b801",
        "referenceNo": "GR-2481",
        "hazardType": "RISING_RIVER_FLOOD",
        "status": "PENDING",
        "submittedAt": "2026-10-02T04:54:00.000Z",
        "...": "the full report object from 9.1"
      },
      {
        "id": "66f9a0c1b2c3d4e5f6a7b7f3",
        "referenceNo": "GR-2476",
        "hazardType": "BLOCKED_ROAD",
        "status": "DISMISSED",
        "dismissalReason": "DUPLICATE",
        "submittedAt": "2026-10-01T11:20:00.000Z",
        "...": "the full report object from 9.1"
      }
    ]
  }
}
```

No reports is `200` with `[]`. Reports still waiting on the phone to be sent aren't on the server, so they aren't in this list; the app adds them itself.

Checked by TC-15.

### 9.4 Pending queue — `GET /api/hazard-reports?status=PENDING`

UC02 main flow step 10. The PENDING reports in the caller's `shiftDistrict`, grouped by cluster.

**Roles:** `duty_officer`.

**Query**

| Parameter | Rule |
|---|---|
| `status` | **Required.** Only `PENDING` is accepted for now. |

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "clusters": [
      {
        "clusterId": "66f9a0c1b2c3d4e5f6a7b7c0",
        "count": 3,
        "reports": [
          {
            "id": "66f9a0c1b2c3d4e5f6a7b801",
            "referenceNo": "GR-2481",
            "hazardType": "RISING_RIVER_FLOOD",
            "submittedAt": "2026-10-02T04:54:00.000Z",
            "...": "the full report object from 9.1"
          }
        ]
      },
      {
        "clusterId": "66f9a0c1b2c3d4e5f6a7b7f9",
        "count": 1,
        "reports": [
          {
            "id": "66f9a0c1b2c3d4e5f6a7b7f9",
            "referenceNo": "GR-2479",
            "hazardType": "LANDSLIDE",
            "submittedAt": "2026-10-02T03:10:00.000Z",
            "...": "the full report object from 9.1"
          }
        ]
      }
    ]
  }
}
```

(The first cluster's other two reports are left out above for brevity; a real response lists all `count` of them.)

- Clusters are ordered by their newest report, newest first; reports inside a cluster are newest first. The first report is the cluster's lead row in the queue.
- `count` is the number of PENDING reports in the cluster. The web shows **"[n similar]"** when it is more than 1.
- Only `PENDING` reports appear, so a cluster disappears once all its reports are reviewed.
- A duty officer with no `shiftDistrict` gets `200` with `[]`. No pending reports is `200` with `[]`.

**Failure — `400 Bad Request`** (`status` missing or not `PENDING`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "status", "message": "must be [PENDING]" }]
  }
}
```

**Failure — `403 Forbidden`** — any role other than `duty_officer`, same body as 9.2.

Checked by TC-09, TC-10.

### 9.5 Report detail — `GET /api/hazard-reports/:id`

UC02 main flow step 11. One report, in any status, plus the other reports in its cluster.

**Roles:** `duty_officer`, for a report in their own `shiftDistrict`.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "66f9a0c1b2c3d4e5f6a7b801",
      "referenceNo": "GR-2481",
      "...": "the full report object from 9.1"
    },
    "cluster": {
      "clusterId": "66f9a0c1b2c3d4e5f6a7b7c0",
      "count": 3,
      "others": [
        {
          "id": "66f9a0c1b2c3d4e5f6a7b7c0",
          "referenceNo": "GR-2474",
          "status": "PENDING",
          "submittedAt": "2026-10-02T04:10:00.000Z"
        },
        {
          "id": "66f9a0c1b2c3d4e5f6a7b7e2",
          "referenceNo": "GR-2478",
          "status": "PENDING",
          "submittedAt": "2026-10-02T04:31:00.000Z"
        }
      ]
    }
  }
}
```

`cluster.count` counts every report in the cluster, whatever its status, including this one; `others` lists the rest, oldest first. The web shows "Cluster: 3 reports within 500 m / 2 h". A report alone in its cluster has `count: 1` and `others: []`.

**Failure — `404 Not Found`** (unknown id, malformed id, or a report in another district)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Hazard report not found."
  }
}
```

**Failure — `403 Forbidden`** — any role other than `duty_officer`.

Checked by TC-11.

### 9.6 Confirm a report — `POST /api/hazard-reports/:id/confirm`

UC02 main flow steps 12–14.

**Roles:** `duty_officer`, for a report in their own `shiftDistrict`.

**Request:** no body.

The report becomes `CONFIRMED`, with `reviewedBy` and `reviewedAt` set and `isEscalatable: true`, and the reporter is notified (9.10). No hazard alert is created and no warning level changes.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "report": {
      "id": "66f9a0c1b2c3d4e5f6a7b801",
      "referenceNo": "GR-2481",
      "status": "CONFIRMED",
      "isEscalatable": true,
      "reviewedBy": { "id": "64f1a2b3c4d5e6f7a8b9c0d5", "name": "Kasun Silva" },
      "reviewedAt": "2026-10-02T05:01:00.000Z",
      "...": "the rest of the report object from 9.1"
    }
  }
}
```

**Failure — `409 Conflict`** (UC02 E3: the report isn't PENDING any more — a colleague got there first)

```json
{
  "success": false,
  "error": {
    "code": "REPORT_ALREADY_REVIEWED",
    "message": "Already reviewed – current status: CONFIRMED"
  }
}
```

Confirm and dismiss are a single conditional update on `status: PENDING`, so when two officers act at the same moment exactly one gets `200` and the other gets this `409`. The client then reloads the report (9.5) to show who reviewed it and when.

**Failure — `404 Not Found`** and **`403 Forbidden`** — as in 9.5.

Checked by TC-12–TC-14, TC-38–TC-40.

### 9.7 Dismiss a report — `POST /api/hazard-reports/:id/dismiss`

UC02 alternate flow A1.

**Roles:** `duty_officer`, for a report in their own `shiftDistrict`.

**Request**

```json
{
  "reason": "DUPLICATE",
  "note": "Same flooding as GR-2474"
}
```

| Field | Rule |
|---|---|
| `reason` | **Required.** One of the `dismissalReason` values in 9.1. Shown as _Inaccurate_, _Duplicate_, _Not a hazard_, _Insufficient evidence_. |
| `note` | Optional. Up to 200 characters. |

The report becomes `DISMISSED`, with `dismissalReason`, `dismissalNote`, `reviewedBy` and `reviewedAt` set and `isEscalatable: false`, and the reporter is told politely (9.10).

**Success — `200 OK`** — `{ "report": ... }`, the updated report object from 9.1.

**Failure — `400 Bad Request`**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "reason", "message": "is required" }]
  }
}
```

**Failure — `409 Conflict`** (`REPORT_ALREADY_REVIEWED`), **`404 Not Found`** and **`403 Forbidden`** — as in 9.6.

Checked by TC-16–TC-19, TC-39.

### 9.8 Search places — `GET /api/places?q=`

UC02 alternate flow A2: when the phone gets no GPS fix, the reporter types a town or village name instead. The places are a seeded gazetteer — no external geocoding service is called.

**Roles:** every role.

**Query**

| Parameter | Rule |
|---|---|
| `q` | **Required.** 2–50 characters. Matched case-insensitively against the start of a place name. |

**Success — `200 OK`** (at most 10 places, sorted by `name`)

```json
{
  "success": true,
  "data": {
    "places": [
      {
        "id": "66f9b1d2c3e4f5a6b7c8d901",
        "name": "Kolonnawa",
        "district": { "id": "66f7c1a2b3c4d5e6f7a8b901", "name": "Colombo" },
        "location": { "latitude": 6.9329, "longitude": 79.8848 }
      }
    ]
  }
}
```

No match is `200` with `[]`. The chosen place's `location` is sent to 9.2 with `locationSource: MANUAL`.

**Failure — `400 Bad Request`** — `q` missing, shorter than 2 or longer than 50 characters (`VALIDATION_ERROR`, field `q`).

Checked by TC-22.

### 9.9 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | A body or query field failed its rule. Carries `errors`, one entry per field. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `403` | `FORBIDDEN` | The caller's role isn't admitted (see the role table at the top of §9). |
| `404` | `NOT_FOUND` | The report doesn't exist, the id isn't valid, or the report is in another district. |
| `409` | `REPORT_ALREADY_REVIEWED` | Confirm or dismiss on a report that is no longer `PENDING`. |
| `502` | `STORAGE_UNAVAILABLE` | Not from these endpoints — from the photo upload before 9.2 (§6). Listed because the app treats it as part of submitting. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

### 9.10 Notifications sent

These are side effects, delivered to the recipient's in-app inbox (the Notifications section, DMS-106). **A notification that fails is recorded and never changes the response** — the report is still stored, confirmed or dismissed.

| After | Recipient | Message |
|---|---|---|
| Submit (9.2), new report only | Every `duty_officer` whose `shiftDistrict` is the report's district. If there is none, every DMC officer instead (`dmc_officer` and `duty_officer`), so no report goes unseen. | "New ground report GR-2481 – Rising river / Flood – Kolonnawa" |
| Confirm (9.6) | The reporter | "Your report GR-2481 was confirmed by the duty officer. Thank you." |
| Dismiss (9.7) | The reporter | "Thank you for report GR-2476. After review it was not used for a warning (reason: Duplicate). Please keep reporting what you see." |

---

## 10. Organisations endpoints

An **organisation** is who holds relief stock and rescue teams in UC03, and who a report can be shared with in UC04 — one record, read by both.

### 10.1 List organisations — `GET /api/organisations`

Requires `Authorization: Bearer <accessToken>`. Admits every role.

**Request:** no body.

| Query param | Rule |
|---|---|
| `type` | Optional. One of `GOVERNMENT`, `ARMED_FORCES`, `POLICE`, `NGO`, `DONOR`. Any other value → `400 VALIDATION_ERROR` on `type`. |

With no param, every organisation is returned.

**Success — `200 OK`** (sorted by `name` ascending; the seeded set shown in full)

```json
{
  "success": true,
  "data": {
    "organisations": [
      { "id": "66f7c1a2b3c4d5e6f7a8b9d1", "name": "ADRA", "type": "NGO", "contactEmail": null },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9d2",
        "name": "Fire Service",
        "type": "GOVERNMENT",
        "contactEmail": null
      },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9d3",
        "name": "Government/DMC",
        "type": "GOVERNMENT",
        "contactEmail": null
      },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9d4",
        "name": "Red Cross Sri Lanka",
        "type": "NGO",
        "contactEmail": "contact@redcross.lk.example.test"
      },
      { "id": "66f7c1a2b3c4d5e6f7a8b9d5", "name": "SL Army", "type": "ARMED_FORCES", "contactEmail": null },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9d6",
        "name": "Sri Lanka Police",
        "type": "POLICE",
        "contactEmail": null
      },
      {
        "id": "66f7c1a2b3c4d5e6f7a8b9d7",
        "name": "UNICEF Sri Lanka",
        "type": "DONOR",
        "contactEmail": "contact@unicef.example.test"
      }
    ]
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The organisation's id. DMS-155 (share a report) refers to a recipient by this id. |
| `name` | string | Unique, e.g. `"Red Cross Sri Lanka"`. |
| `type` | string | One of `GOVERNMENT`, `ARMED_FORCES`, `POLICE`, `NGO`, `DONOR`. |
| `contactEmail` | string or `null` | Set for organisations DMS-155 can email a shared report to; `null` otherwise. |
| `createdAt`, `updatedAt` | ISO 8601 string | Omitted above for brevity; present on every record, same as §7. |

**Failure — `400 Bad Request`** (unknown `type` value)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "type", "message": "must be one of [GOVERNMENT, ARMED_FORCES, POLICE, NGO, DONOR]" }]
  }
}
```

**Failure — `401 Unauthorized`** — as in §7.3.

### 10.2 Error codes for this endpoint

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `type` is not one of the `OrgType` values. Carries `errors`. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

---

## 11. Notifications endpoints

The **in-app inbox** every user has: the console's bell (web) and the app's _Inbox_ tab. Every use case that tells a person something stores one inbox item for them, through the shared notification service: UC01's warnings (as the visible stand-in for the mocked push, SMS and audible delivery), UC02's report updates (§9.10) and UC03's assignments and capacity alerts. Nothing in this section sends anything; these two endpoints only read the inbox and mark items read.

An inbox item is a **user notification**. It is deliberately not UC01's `Notification`, which records one delivery attempt per citizen and channel for a hazard warning, and never reaches a client as an inbox item.

Both endpoints require `Authorization: Bearer <accessToken>` and admit **every role**. A user only ever sees their own items: another user's item — or an `:id` that is unknown or not a valid id — is `404 NOT_FOUND`, so its existence isn't revealed.

### 11.1 The user notification object

```json
{
  "id": "66fa1b2c3d4e5f6a7b8c9d01",
  "type": "REPORT_CONFIRMED",
  "title": "Report confirmed",
  "body": "Your report GR-2481 was confirmed by the duty officer. Thank you.",
  "link": "/my-reports/66f9a0c1b2c3d4e5f6a7b801",
  "severity": null,
  "readAt": null,
  "createdAt": "2026-10-02T05:01:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The item's id. |
| `type` | enum | What the item is about (`NotificationType`), so a client can pick an icon or a card. See the table below. |
| `title` | string | 1–80 characters. The bold first line. |
| `body` | string | 1–500 characters. The message itself. |
| `link` | string or `null` | A client route to open when the item is tapped, e.g. `/my-reports/<id>` or `/assignments/<id>`. A client that doesn't know the route shows the item without navigating. |
| `severity` | enum or `null` | `LOW`, `MEDIUM`, `HIGH`, `SEVERE` (UC01's `SeverityLevel`). Set only for `HAZARD_ALERT`, which the app shows as an alert card coloured by severity; `null` for every other type. |
| `readAt` | ISO 8601 string or `null` | When the owner marked it read (11.3). `null` means unread. |
| `createdAt` | ISO 8601 string | Set by the server. The inbox is sorted by this, newest first. |

**`type` values.** A closed list: a new kind of message adds a row here first.

| `type` | Sent by | To |
|---|---|---|
| `HAZARD_ALERT` | UC01 broadcast, update and all-clear (DMS-121, 123, 124) | Every citizen in the warning's scope |
| `REPORT_SUBMITTED` | UC02 submit (§9.2) | The duty officers on shift for the report's district |
| `REPORT_CONFIRMED` | UC02 confirm (§9.6) | The reporter |
| `REPORT_DISMISSED` | UC02 dismiss (§9.7) | The reporter |
| `ASSIGNMENT` | UC03 dispatch (DMS-142) | The rescue team lead |
| `SHELTER_CAPACITY` | UC03 E2, all shelters near capacity (DMS-148) | DMC officers |
| `SUPPORT_REQUEST` | UC03 E3, no team available (DMS-149) | DMC officers |
| `DISPATCH_DECLINED` | UC03 A3, a team lead declines a dispatch (DMS-146) | The district officer who created the dispatch |
| `DISPATCH_UNRESPONSIVE` | UC03 E4, a dispatch passes its acknowledgement deadline (DMS-150) | The district officer who created the dispatch |

### 11.2 My inbox — `GET /api/notifications/me`

The caller's own items, newest first, one page at a time. The web bell polls this every 30 seconds, so it also returns the unread count across the whole inbox.

**Query**

| Parameter | Rule |
|---|---|
| `page` | Optional. An integer ≥ 1. Defaults to `1`. |
| `limit` | Optional. An integer from 1 to 50. Defaults to `20`. |

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "66fa1b2c3d4e5f6a7b8c9d02",
        "type": "HAZARD_ALERT",
        "title": "Flood Warning: SEVERE",
        "body": "Flood Warning: SEVERE. Move to higher ground and follow official guidance.",
        "link": null,
        "severity": "SEVERE",
        "readAt": null,
        "createdAt": "2026-10-02T06:30:00.000Z"
      },
      {
        "id": "66fa1b2c3d4e5f6a7b8c9d01",
        "type": "REPORT_CONFIRMED",
        "title": "Report confirmed",
        "body": "Your report GR-2481 was confirmed by the duty officer. Thank you.",
        "link": "/my-reports/66f9a0c1b2c3d4e5f6a7b801",
        "severity": null,
        "readAt": "2026-10-02T05:10:00.000Z",
        "createdAt": "2026-10-02T05:01:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 2,
    "unreadCount": 1
  }
}
```

| Field | Notes |
|---|---|
| `notifications` | The requested page, newest first (ties broken by `id`, so pages never overlap). An empty inbox, or a page past the end, is `200` with `[]`. |
| `page`, `limit` | The values actually used, after defaults. |
| `total` | Every item the caller has, read or not. |
| `unreadCount` | Every item with `readAt: null`, across all pages. The number on the bell. |

**Failure — `400 Bad Request`** (`limit` out of range)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "limit", "message": "must be less than or equal to 50" }]
  }
}
```

### 11.3 Mark one read — `PATCH /api/notifications/:id/read`

**Request:** no body.

Sets `readAt` on the caller's own item and returns it. Marking an item that is already read is not an error: it returns `200` and keeps the original `readAt`.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "notification": {
      "id": "66fa1b2c3d4e5f6a7b8c9d02",
      "type": "HAZARD_ALERT",
      "readAt": "2026-10-02T06:41:00.000Z",
      "...": "the rest of the user notification object from 11.1"
    }
  }
}
```

**Failure — `404 Not Found`** (someone else's item, an unknown id, or an id that isn't valid)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Notification not found."
  }
}
```

### 11.4 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `page` or `limit` failed its rule (11.2). Carries `errors`. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `404` | `NOT_FOUND` | 11.3 only: the item isn't the caller's, doesn't exist, or the id isn't valid. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

No new error codes.

### 11.5 How other sections send one

For server code, not clients. A use case never writes an inbox item itself; it calls the shared `NotificationService` (DMS-106):

- `notifyUser(userId, { type, title, body, link?, severity? })` — one item for one user.
- `notifyRole(role, { districtId?, districtField? }, payload)` — one item for every active user holding `role`, through role inheritance (`dmc_officer` also reaches every `duty_officer`), optionally only those whose `districtField` (`homeDistrict`, `district` or `shiftDistrict`) is `districtId`.

**A notification that fails is recorded and never fails the caller's request**, as §9.10 already relies on.

---

## 12. Hazard alerts endpoints

UC01 Issue Hazard Warning. An officer composes a location-specific warning, previews how many citizens it will reach and what they will read, and then broadcasts it (DMS-121). This section covers **composing** (UC01 main flow steps 1–8: start a draft, preview it, save an edited message, read an alert back) and **broadcasting** (steps 9–14: broadcast, delivery summary). Composing never sends anything, and no delivery record exists while an alert is `DRAFT`.

Every endpoint requires `Authorization: Bearer <accessToken>` and admits `dmc_officer` and `duty_officer` (a duty officer is a DMC officer). Every other role is `403 FORBIDDEN`. Drafts are shared work: any admitted officer can open, preview and edit any draft, not only its creator.

An `:id` that is unknown or not a valid id is `404 NOT_FOUND`.

### 12.1 The alert object

Every endpoint below that returns an alert returns this shape. A new draft has no type, severity, scope or message yet; they are filled in by the preview (12.3).

```json
{
  "id": "66fb2c3d4e5f6a7b8c9d0e01",
  "referenceNo": "HA-1043",
  "hazardType": "FLOOD",
  "severity": "SEVERE",
  "message": "Flood Warning: SEVERE. Move to higher ground and follow official guidance.",
  "status": "DRAFT",
  "version": 1,
  "targets": [
    { "kind": "District", "id": "66f7c1a2b3c4d5e6f7a8b901", "name": "Colombo" },
    { "kind": "RiverBasin", "id": "66f7c1a2b3c4d5e6f7a8b9a1", "name": "Kelani" }
  ],
  "event": { "id": "66f7c1a2b3c4d5e6f7a8b9c1", "name": "Flood – Gampaha District" },
  "sourceReport": null,
  "createdBy": { "id": "64f1a2b3c4d5e6f7a8b9c0d5", "name": "Kasun Silva" },
  "issuedBy": null,
  "issuedAt": null,
  "statusHistory": [
    {
      "status": "DRAFT",
      "version": 1,
      "at": "2026-10-02T06:20:00.000Z",
      "by": { "id": "64f1a2b3c4d5e6f7a8b9c0d5", "name": "Kasun Silva" }
    }
  ],
  "createdAt": "2026-10-02T06:20:00.000Z",
  "updatedAt": "2026-10-02T06:24:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | The alert's id. |
| `referenceNo` | string | `HA-` plus a zero-padded number, unique and assigned by the server when the draft is created, e.g. `"HA-1043"`. This is what officers see ("Delivery summary – Alert HA-1043"). |
| `hazardType` | enum or `null` | `FLOOD`, `LANDSLIDE`, `CYCLONE`, `DROUGHT` (`AlertHazardType`). Not the same list as UC02's report hazard types. `null` until the first preview. |
| `severity` | enum or `null` | `LOW`, `MEDIUM`, `HIGH`, `SEVERE` (`SeverityLevel`). `null` until the first preview. |
| `message` | string or `null` | What citizens will read, 1–160 characters so it fits in one SMS. Generated by the preview, then optionally edited (12.4); always the latest of the two. `null` until the first preview. |
| `status` | enum | `DRAFT` → `BROADCAST` → `UPDATED` (each update) → `CANCELLED` (all-clear) (`AlertStatus`). `BROADCAST` and `UPDATED` are *active*. Composing (12.3–12.4) and broadcasting (12.6) work only on a `DRAFT`. |
| `version` | integer | `1` for a new alert; each update adds one (DMS-123). |
| `targets` | `[{ kind, id, name }]` | The target scope: `kind` is `District` or `RiverBasin`, and `id` is an area id from §7, in the order they were chosen. `[]` until the first preview. |
| `event` | `{ id, name }` or `null` | The `ACTIVE` hazard event (§8) that covers the scope, set by the preview when there is one, so UC04 can group alerts by event. |
| `sourceReport` | `{ id, referenceNo }` or `null` | The confirmed hazard report this warning was escalated from (UC01 A1, DMS-122). `null` otherwise. |
| `createdBy` | `{ id, name }` | The officer who started the draft. |
| `issuedBy`, `issuedAt` | `{ id, name }` / ISO 8601 string, or `null` | Set when the alert is broadcast (DMS-121). `null` while `DRAFT`. |
| `statusHistory` | `[{ status, version, at, by }]` | One entry per status change, oldest first. A new draft has exactly one: `DRAFT`, version `1`. |
| `createdAt`, `updatedAt` | ISO 8601 string | |

### 12.2 Start a draft — `POST /api/hazard-alerts`

UC01 main flow steps 1–2. The web console calls this as soon as the officer opens *Issue Hazard Warning*, so the draft exists while they compose it.

**Request:** an empty object `{}`. (DMS-122 adds an optional `sourceReportId` for escalating a confirmed report; it is documented there.)

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "66fb2c3d4e5f6a7b8c9d0e01",
      "referenceNo": "HA-1043",
      "hazardType": null,
      "severity": null,
      "message": null,
      "status": "DRAFT",
      "version": 1,
      "targets": [],
      "event": null,
      "...": "the rest of the alert object from 12.1"
    }
  }
}
```

**Failure — `403 Forbidden`** (`district_officer`, a citizen, or any field role)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

**Failure — `401 Unauthorized`** — see 12.8.

Checked by TC-01–TC-03.

### 12.3 Preview — `POST /api/hazard-alerts/:id/preview`

UC01 main flow steps 3–7. Sent whenever the officer has chosen a hazard type, a severity and at least one area, and again whenever they change one.

**Request**

```json
{
  "hazardType": "FLOOD",
  "severity": "SEVERE",
  "areaIds": ["66f7c1a2b3c4d5e6f7a8b901", "66f7c1a2b3c4d5e6f7a8b9a1"]
}
```

| Field | Rule |
|---|---|
| `hazardType` | **Required.** One of the `hazardType` values in 12.1. |
| `severity` | **Required.** One of the `severity` values in 12.1. |
| `areaIds` | **Required.** At least one area id from §7: a district id or a river basin id, in any mix. A repeated id counts once. |

The server then:

1. **Validates the scope** (step 6). Every id must be a registered district or river basin; otherwise the request fails with `400` on `areaIds`, naming the unknown ids (UC01 E1, DMS-126).
2. **Checks for an active warning** of the same hazard type covering any of the same districts (UC01 A2, DMS-123), and returns it as `activeWarning`.
3. **Counts the recipients** (step 7): the active `citizen` and `community_volunteer` accounts whose home district is covered by the scope. A basin covers every district it spans, and **each citizen is counted once**, even when a district and a basin covering it are both selected.
4. **Generates the message** from the hazard type and severity, at most 160 characters.
5. **Stores** the hazard type, severity, scope, message and covering `ACTIVE` event on the draft. The status stays `DRAFT`.

A preview that finds **no recipients is not an error**: it is `200` with `recipientCount: 0` (UC01 E2, DMS-127), and the broadcast is refused later.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "66fb2c3d4e5f6a7b8c9d0e01",
      "referenceNo": "HA-1043",
      "hazardType": "FLOOD",
      "severity": "SEVERE",
      "message": "Flood Warning: SEVERE. Move to higher ground and follow official guidance.",
      "status": "DRAFT",
      "targets": [
        { "kind": "District", "id": "66f7c1a2b3c4d5e6f7a8b901", "name": "Colombo" },
        { "kind": "RiverBasin", "id": "66f7c1a2b3c4d5e6f7a8b9a1", "name": "Kelani" }
      ],
      "...": "the rest of the alert object from 12.1"
    },
    "recipientCount": 48200,
    "message": "Flood Warning: SEVERE. Move to higher ground and follow official guidance.",
    "channels": [
      { "channel": "PUSH", "ready": true },
      { "channel": "SMS", "ready": true },
      { "channel": "AUDIBLE", "ready": true }
    ],
    "activeWarning": null
  }
}
```

| Field | Notes |
|---|---|
| `alert` | The draft as now stored. |
| `recipientCount` | Distinct citizens in scope. The web shows it as "48,200 citizens in target scope". |
| `message` | The generated message, the same as `alert.message`. The officer may edit it (12.4). |
| `channels` | Every channel the broadcast will use (`PUSH`, `SMS`, `AUDIBLE`), in that order, with whether it is ready. |
| `activeWarning` | `null`, or the conflicting active warning as `{ id, referenceNo, hazardType, severity, targets, version }` (DMS-123). |

**Failure — `400 Bad Request`** (UC01 E1: an unknown area)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "areaIds", "message": "unknown area ids: 66f7c1a2b3c4d5e6f7a8b999" }
    ]
  }
}
```

An empty `areaIds` is `400` on `areaIds` too ("must contain at least 1 items"), as is a malformed id. A missing or unknown `hazardType` or `severity` is `400` on that field.

**Failure — `409 Conflict`** (the alert is no longer a draft)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ALERT_TRANSITION",
    "message": "Only a DRAFT alert can be previewed – current status: BROADCAST"
  }
}
```

**Failure — `404 Not Found`** and **`403 Forbidden`** — see 12.8.

Checked by TC-04–TC-06; E1 by TC-32–TC-35; E2 by TC-36–TC-38.

### 12.4 Save the edited message — `PATCH /api/hazard-alerts/:id/draft`

UC01 main flow step 8. The officer has edited the generated message.

**Request**

```json
{ "message": "Flood Warning: SEVERE. Move to higher ground now. Kelani river is rising fast." }
```

| Field | Rule |
|---|---|
| `message` | **Required.** 1–160 characters after trimming, so it fits in one SMS. |

Only the message changes. A later preview generates a new message and replaces it, because the type or severity it was written for may have changed.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "66fb2c3d4e5f6a7b8c9d0e01",
      "message": "Flood Warning: SEVERE. Move to higher ground now. Kelani river is rising fast.",
      "status": "DRAFT",
      "...": "the rest of the alert object from 12.1"
    }
  }
}
```

**Failure — `400 Bad Request`** (161 characters)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "message", "message": "length must be less than or equal to 160 characters long" }]
  }
}
```

**Failure — `409 Conflict`** `INVALID_ALERT_TRANSITION` — the alert is no longer a draft, as in 12.3.

**Failure — `404 Not Found`** and **`403 Forbidden`** — see 12.8.

Checked by TC-07, TC-08.

### 12.5 Read one alert — `GET /api/hazard-alerts/:id`

Any status. Used to reopen a draft, and by the delivery summary screen (DMS-121).

**Request:** no body.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "alert": { "...": "the alert object from 12.1" }
  }
}
```

**Failure — `404 Not Found`** (an unknown id, or one that isn't valid)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Hazard alert not found."
  }
}
```

### 12.6 Broadcast — `POST /api/hazard-alerts/:id/broadcast`

UC01 main flow steps 9–14. The web console shows a confirmation dialog first ("You are about to send a SEVERE Flood warning to 48,200 citizens in Colombo and Gampaha via Push, SMS and Audible alert. This cannot be recalled."), and calls this only when the officer selects **Broadcast now**. Backing out of the dialog sends nothing (UC01 A4).

**Request**

```json
{ "message": "Flood Warning: SEVERE. Move to higher ground and follow official guidance." }
```

| Field | Rule |
|---|---|
| `message` | **Required.** 1–160 characters after trimming: the text as the officer last saw it in the dialog. It replaces the draft's message. |

The server then:

1. **Re-checks the draft** against the current data, in case the preview is stale: the scope is still registered, and the recipients are counted again.
2. Sets the alert to **`BROADCAST`**, records `issuedBy` (the caller) and `issuedAt`, and adds a `statusHistory` entry.
3. For **every recipient and every channel** (`PUSH`, `SMS`, `AUDIBLE`), creates one delivery record as `QUEUED`, sends it through that channel, and records the result: `SENT`, `DELIVERED` or `FAILED`. A channel that fails never stops the others, and never fails the request.
4. Puts the warning in each recipient's in-app inbox (§11, type `HAZARD_ALERT`, with the severity). This is the visible stand-in for the mocked push, SMS and audible delivery.
5. Returns the alert and its delivery summary.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "66fb2c3d4e5f6a7b8c9d0e01",
      "referenceNo": "HA-1043",
      "status": "BROADCAST",
      "version": 1,
      "issuedBy": { "id": "64f1a2b3c4d5e6f7a8b9c0d5", "name": "Kasun Silva" },
      "issuedAt": "2026-10-02T06:31:00.000Z",
      "...": "the rest of the alert object from 12.1"
    },
    "summary": { "...": "the summary object from 12.7" }
  }
}
```

**Failure — `409 Conflict`** (the alert isn't a `DRAFT`: it was already broadcast, possibly by a colleague, or it was never previewed)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ALERT_TRANSITION",
    "message": "Only a DRAFT alert can be broadcast – current status: BROADCAST"
  }
}
```

A draft without a hazard type, severity or scope (it was never previewed) gets the same code, with the message "Preview the warning before broadcasting it". Either way nothing is sent and no delivery record is created. UC01 A2 adds its own `409` here (`ACTIVE_WARNING_EXISTS`, DMS-123).

**Failure — `409 Conflict`** (UC01 E2: the scope holds no registered citizens, counted again at broadcast)

```json
{
  "success": false,
  "error": {
    "code": "NO_RECIPIENTS_IN_SCOPE",
    "message": "No registered citizens are in the selected scope"
  }
}
```

The alert stays `DRAFT` and no delivery record or inbox item is created. The officer changes the scope (step 5) and previews again. The preview itself never refuses an empty scope: it returns `recipientCount: 0` (12.3), and the web disables **Confirm & Broadcast**.

**Failure — `400 Bad Request`** — `message` missing, empty or over 160 characters, as in 12.4.

**Failure — `404 Not Found`** and **`403 Forbidden`** — see 12.8.

Checked by TC-09, TC-10, TC-12–TC-14; E2 by TC-37 and TC-38.

### 12.7 Delivery summary — `GET /api/hazard-alerts/:id/delivery-summary`

UC01 main flow step 14: the **Delivery summary** screen ("Delivery summary – Alert HA-1043 (BROADCAST)"), reopened at any time. The counts come from the stored delivery records, so they always match what was recorded.

**Request:** no body.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "alert": { "...": "the alert object from 12.1" },
    "summary": {
      "version": 1,
      "perChannel": [
        { "channel": "PUSH", "sent": 48200, "delivered": 44910, "failed": 3290 },
        { "channel": "SMS", "sent": 48200, "delivered": 47960, "failed": 240 },
        { "channel": "AUDIBLE", "sent": 48200, "delivered": 48080, "failed": 120 }
      ],
      "totals": { "sent": 144600, "delivered": 140950, "failed": 3650 },
      "fallback": { "channel": "SMS", "resent": 0 },
      "unreachedCount": 0
    }
  }
}
```

| Field | Notes |
|---|---|
| `version` | The alert version the counts are for: its current version. Each update is sent as a new version (DMS-123). |
| `perChannel` | One row per channel, always all three in this order, even when a count is `0`. `sent` counts every delivery that left the queue, so `sent = delivered + failed + ` those still only `SENT` (accepted by the channel but not yet confirmed). |
| `totals` | The three columns summed over every channel. |
| `fallback` | Failed alerts resent through the fallback channel (UC01 E3, DMS-128): "3,050 failed push alerts resent via SMS". `resent` is `0` until DMS-128. |
| `unreachedCount` | Distinct citizens for whom no channel ended `DELIVERED` (UC01 E3, DMS-128): "240 citizens not reached". |

A `DRAFT` has sent nothing, so its summary is all zeros, not an error.

**Failure — `404 Not Found`** and **`403 Forbidden`** — see 12.8.

Checked by TC-11.

### 12.8 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | A body field failed its rule, or `areaIds` names an area that isn't registered. Carries `errors`, one entry per field. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `403` | `FORBIDDEN` | The caller isn't a `dmc_officer` or `duty_officer`. |
| `404` | `NOT_FOUND` | The alert doesn't exist, or the id isn't valid. |
| `409` | `INVALID_ALERT_TRANSITION` | Preview, save-message or broadcast on an alert that is no longer `DRAFT`, or broadcast of a draft that was never previewed. |
| `409` | `NO_RECIPIENTS_IN_SCOPE` | Broadcast of a draft whose scope holds no registered citizens (UC01 E2). |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

### 12.9 The delivery record

One record per recipient, channel and alert version, created by a broadcast (12.6), an update or an all-clear. Clients never receive these records; the delivery summary (12.7) counts them, and post-event reports (§14) read them for "citizens reached".

| Field | Type | Notes |
|---|---|---|
| `alert` | alert id | The hazard alert (12.1). |
| `alertVersion` | integer | The alert's `version` this delivery was for. |
| `kind` | enum | `WARNING` (the first broadcast), `UPDATE` or `ALL_CLEAR`. |
| `citizen` | user id | The recipient: a `citizen` or `community_volunteer`. |
| `channel` | enum | `PUSH`, `SMS` or `AUDIBLE`. |
| `status` | enum | `QUEUED` → `SENT`, `DELIVERED` or `FAILED`. |
| `attempts` | integer | Starts at 1. The SMS fallback (UC01 E3) retries up to 3 attempts in total. |
| `sentAt` | date or `null` | When it left the queue. |
| `deliveredAt` | date or `null` | When the channel reported delivery. |
| `failureReason` | string or `null` | Set when `FAILED`. |

Unique on `{ alert, alertVersion, citizen, channel }`; also indexed by `{ alert, status }`.

---

## 13. Coordination endpoints

UC03 Coordinate Shelter and Resource Allocation. While an incident is active for a district, the **district officer** runs a coordination hub with three independent sub-flows, which can be performed in any order and repeated: update shelter occupancy, dispatch rescue teams and log relief supplies. The **rescue team lead** answers dispatches from the mobile field app. **DMC officers** read the same combined operational picture, filtered by organisation if needed. Every rescue team and stock item belongs to an **organisation** (§10); organisations themselves never call these endpoints.

Frozen at `contract-freeze-1` (DMS-112). Each UC03 story builds against its own subsection; changing one follows §15.

### 13.1 Roles, district scoping and the active incident

Every endpoint requires `Authorization: Bearer <accessToken>`. "DMC officers" means `dmc_officer` and `duty_officer`: a duty officer is a DMC officer, per the server's role inheritance.

| Endpoints | Roles | Anyone else |
|---|---|---|
| Reads: picture (13.3), shelters (13.4), teams (13.5), relief stock (13.11.1), dispatch list and detail (13.7.3, 13.7.4) | `district_officer` for their own district; DMC officers for any district | `403 FORBIDDEN` |
| Available teams (13.6) and officer writes: occupancy (13.4.2), register shelter (13.4.3), redirect (13.4.4), dispatch (13.7.2), queue and assign (13.9), mark available (13.10.1), log supply (13.11.2) | `district_officer` only, for records in their own district | `403 FORBIDDEN` |
| Field app: my assignments, acknowledge, decline, on site, complete (13.7.5 – 13.8) | `rescue_team_lead`, and for a single dispatch only the lead of its assigned team | `403 FORBIDDEN` |

**District scoping.** Every UC03 record belongs to one district (§7.1).
- A district officer works in the `district` on their profile. On the reads, `districtId` is optional and defaults to that district; any other `districtId` → `403 FORBIDDEN`. A district officer with no `district` on their profile → `403 FORBIDDEN` on every endpoint.
- DMC officers have no district of their own, so `districtId` is **required** on their reads (missing → `400 VALIDATION_ERROR` on `districtId`). They can read any district.
- An `:id` or body id naming a shelter, team, stock item or dispatch in another district → `403 FORBIDDEN`. The district is not a secret here, unlike a citizen's report, so it is not hidden behind a `404`.

**Active incident.** The UC03 precondition is "An incident is active for the district": the district's `ACTIVE` hazard event (§8) is the incident. Every **officer write** is refused with `409 NO_ACTIVE_INCIDENT` while the district has none, and nothing is changed. Reads still work and return `incident: null`. The field-app actions on an existing dispatch are not blocked: a team already on its way finishes the job.

**Ids.** A malformed or unknown `:id` → `404 NOT_FOUND`. A malformed id in the body or query → `400 VALIDATION_ERROR` on that field; a well-formed but unknown one → `404 NOT_FOUND`.

### 13.2 Values and objects

**Enums.** Exactly the UC03 class diagram's values, in the order shown. `OrgType` belongs to §10 Organisations.

| Enum | Values |
|---|---|
| `ShelterStatus` | `AVAILABLE`, `FILLING_UP`, `NEAR_CAPACITY`, `FULL` |
| `TeamStatus` | `AVAILABLE`, `DISPATCHED`, `ON_SITE`, `UNAVAILABLE` |
| `DispatchStatus` | `ASSIGNED`, `ACKNOWLEDGED`, `ON_SITE`, `COMPLETED`, `DECLINED`, `UNRESPONSIVE`, plus `UNASSIGNED`. `UNASSIGNED` is the unassigned queue (E3, 13.9), an addition to the class diagram logged in the deviation log. |
| `Priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `SupplyType` | `FOOD`, `WATER`, `MEDICINE`, `BLANKETS`, `HYGIENE_KITS` |

**Shelter status** comes from the occupancy rate, `currentOccupancy / capacity`, compared exactly (no rounding at the boundaries):

| Rate | Status |
|---|---|
| below 0.75 | `AVAILABLE` |
| 0.75 up to 0.90 | `FILLING_UP` |
| 0.90 up to 1.00 | `NEAR_CAPACITY` |
| 1.00 or more | `FULL` |

A shelter has **spare capacity** when its status is `AVAILABLE` or `FILLING_UP`, i.e. its rate is below 0.90.

**References.** Records point at each other with small `{ id, name }` objects, so a client never needs a second request just to show a name. An organisation reference also carries its `type`: `{ id, name, type }`.

**Locations** are `{ lat, lng, label }` in decimal degrees (WGS 84). `label` is an optional address or description such as `"Biyagama – flooded road"`, and is `null` when not given.

#### The shelter object

```json
{
  "id": "66fb0a1b2c3d4e5f6a7b8c01",
  "name": "Gampaha Central College",
  "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
  "location": { "lat": 7.0912, "lng": 79.9948, "label": "Gampaha town" },
  "capacity": 500,
  "currentOccupancy": 460,
  "rate": 0.92,
  "status": "NEAR_CAPACITY",
  "redirectingTo": { "id": "66fb0a1b2c3d4e5f6a7b8c02", "name": "Minuwangoda National School" },
  "createdAt": "2026-09-30T06:00:00.000Z",
  "updatedAt": "2026-10-03T09:30:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `capacity` | integer | 1 or more. |
| `currentOccupancy` | integer | 0 or more. It may exceed `capacity`: nobody is turned away by the software, and the shelter shows as `FULL`. |
| `rate` | number | `currentOccupancy / capacity`, unrounded, e.g. `0.92`, or `1.05` over capacity. Show `status` as given rather than recomputing it from a rounded percentage. |
| `status` | `ShelterStatus` | Derived from `rate` by the table above. |
| `redirectingTo` | reference or `null` | The shelter new arrivals are redirected to (13.4.4). Only set while this shelter is `NEAR_CAPACITY` or `FULL`. |

#### The rescue team object

```json
{
  "id": "66fb0b1b2c3d4e5f6a7b8d01",
  "name": "Team Alpha",
  "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d5", "name": "SL Army", "type": "ARMED_FORCES" },
  "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
  "memberCount": 8,
  "lead": { "id": "66f1a2b3c4d5e6f7a8b9c0d3", "name": "Suresh Bandara" },
  "baseLocation": { "lat": 7.0873, "lng": 80.0144, "label": "Gampaha Army Camp" },
  "currentLocation": { "lat": 7.0873, "lng": 80.0144, "label": "Gampaha Army Camp" },
  "status": "DISPATCHED",
  "currentTask": {
    "dispatchId": "66fb0c1b2c3d4e5f6a7b8e01",
    "status": "ACKNOWLEDGED",
    "priority": "HIGH",
    "incidentLocation": { "lat": 6.9555, "lng": 79.9865, "label": "Biyagama – flooded road" }
  },
  "createdAt": "2026-09-30T06:00:00.000Z",
  "updatedAt": "2026-10-03T09:35:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `lead` | `{ id, name }` | A `rescue_team_lead` user. Only this user can answer the team's dispatches. |
| `currentLocation` | location | Starts at `baseLocation`; becomes the incident location when the team goes on site. Distances are measured from here. |
| `status` | `TeamStatus` | |
| `currentTask` | object or `null` | The team's open dispatch (`ASSIGNED`, `ACKNOWLEDGED` or `ON_SITE`), for the dashboard's "Current task" column. `null` when it has none. |

#### The relief stock object

```json
{
  "id": "66fb0d1b2c3d4e5f6a7b8f01",
  "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
  "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
  "supplyType": "WATER",
  "unit": "bottles",
  "quantityAvailable": 1200,
  "updatedAt": "2026-10-03T08:00:00.000Z"
}
```

One row is what one organisation holds of one supply type in one district. `quantityAvailable` is an integer, 0 or more, and never goes negative.

#### The supply distribution object

```json
{
  "id": "66fb0e1b2c3d4e5f6a7b9001",
  "shelter": { "id": "66fb0a1b2c3d4e5f6a7b8c01", "name": "Gampaha Central College" },
  "stockId": "66fb0d1b2c3d4e5f6a7b8f01",
  "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
  "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
  "supplyType": "WATER",
  "unit": "bottles",
  "quantity": 500,
  "distributedAt": "2026-10-03T10:15:00.000Z",
  "loggedBy": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" }
}
```

`organisation`, `supplyType` and `district` are copied from the stock row when the distribution is logged, so post-event reports (UC04) read them directly.

#### The dispatch object

```json
{
  "id": "66fb0c1b2c3d4e5f6a7b8e01",
  "status": "ASSIGNED",
  "team": {
    "id": "66fb0b1b2c3d4e5f6a7b8d01",
    "name": "Team Alpha",
    "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d5", "name": "SL Army", "type": "ARMED_FORCES" }
  },
  "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
  "incident": { "id": "66f7c1a2b3c4d5e6f7a8b9c1", "name": "Flood – Gampaha District" },
  "incidentLocation": { "lat": 6.9555, "lng": 79.9865, "label": "Biyagama – flooded road" },
  "priority": "HIGH",
  "supportRequested": false,
  "createdBy": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" },
  "createdAt": "2026-10-03T09:30:00.000Z",
  "ackDeadline": "2026-10-03T09:35:00.000Z",
  "declineReason": null,
  "statusHistory": [
    {
      "status": "ASSIGNED",
      "at": "2026-10-03T09:30:00.000Z",
      "by": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" }
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | `DispatchStatus` | Moves only along the transitions below. |
| `team` | object or `null` | `null` only while `UNASSIGNED`. Includes the owning organisation. |
| `incident` | `{ id, name }` | The district's `ACTIVE` hazard event when the dispatch was created. |
| `supportRequested` | boolean | `true` when the officer asked the DMC for support (E3, 13.9). |
| `ackDeadline` | ISO 8601 string or `null` | When the dispatch entered `ASSIGNED`, plus `DISPATCH_ACK_TIMEOUT_MINUTES` (server setting, default 5). `null` while `UNASSIGNED`. |
| `declineReason` | string or `null` | Set by a decline (13.8). |
| `statusHistory` | `[{ status, at, by }]` | One entry per status, oldest first. `by` is `null` when the server made the change (a timeout). |

**Dispatch transitions.** Any other move → `409 INVALID_DISPATCH_TRANSITION`.

| From | To | Through | Team becomes |
|---|---|---|---|
| (new) | `ASSIGNED` | create (13.7.2) | `DISPATCHED` |
| (new) | `UNASSIGNED` | create unassigned (13.9.1) | — |
| `UNASSIGNED` | `ASSIGNED` | assign (13.9.2) | `DISPATCHED` |
| `ASSIGNED` | `ACKNOWLEDGED` | acknowledge (13.7.6) | stays `DISPATCHED` |
| `ASSIGNED` | `DECLINED` | decline (13.8) | `AVAILABLE` |
| `ASSIGNED` | `UNRESPONSIVE` | the deadline passes (13.10) | `UNAVAILABLE` |
| `ACKNOWLEDGED` | `ON_SITE` | on site (13.7.7) | `ON_SITE` |
| `ON_SITE` | `COMPLETED` | complete (13.7.8) | `AVAILABLE` |

A dispatch is **overdue** when it is `ASSIGNED` and the time is later than `ackDeadline`; at exactly the deadline it is not. An overdue dispatch is marked `UNRESPONSIVE` by a background check every 30 seconds, and also whenever it is read or acted on, so no response ever shows a stale `ASSIGNED`. Reassigning after a decline or timeout creates a **new** dispatch (13.7.2) for another team; the old one keeps its final status.

### 13.3 Combined operational picture — `GET /api/operational-picture`

UC03 main flow steps 1–2 and 14 (DMS-140). Everything the coordination dashboard shows, in one request. The dashboard refetches it after every action.

**Roles:** `district_officer` (own district), DMC officers (any district).

| Query param | Rule |
|---|---|
| `districtId` | A district id from §7.1. Optional for a district officer, required for DMC officers (13.1). |
| `organisationId` | Optional. An organisation id. Narrows `teams`, `recentDistributions`, `totalsByOrganisation` and the team and supply figures in `summary` to that organisation. Shelters belong to no organisation, so they are always all shown. |

**Success — `200 OK`** (lists shortened to one entry each)

```json
{
  "success": true,
  "data": {
    "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
    "incident": {
      "id": "66f7c1a2b3c4d5e6f7a8b9c1",
      "name": "Flood – Gampaha District",
      "hazardType": "FLOOD",
      "startDate": "2026-09-25T00:00:00.000Z"
    },
    "organisation": null,
    "summary": {
      "shelters": 5,
      "sheltersNearCapacity": 1,
      "teams": 5,
      "teamsAvailable": 3,
      "suppliesDistributed": 2450,
      "affectedPeople": 1505
    },
    "shelters": [{ "id": "66fb0a1b2c3d4e5f6a7b8c01", "name": "Gampaha Central College", "...": "the shelter object" }],
    "teams": [{ "id": "66fb0b1b2c3d4e5f6a7b8d01", "name": "Team Alpha", "...": "the rescue team object" }],
    "recentDistributions": [{ "id": "66fb0e1b2c3d4e5f6a7b9001", "...": "the supply distribution object" }],
    "totalsByOrganisation": [
      {
        "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
        "teams": 0,
        "stockItems": 3400,
        "distributed": 1200
      }
    ]
  }
}
```

| Field | Notes |
|---|---|
| `incident` | The district's `ACTIVE` hazard event, or `null` when there is none. The dashboard then shows "No active incident for Gampaha" and disables its actions (13.1). |
| `organisation` | The `organisationId` filter as a reference, or `null` for all organisations. |
| `summary.shelters`, `sheltersNearCapacity` | All shelters, and those `NEAR_CAPACITY` or `FULL`. |
| `summary.teams`, `teamsAvailable` | Teams, and those `AVAILABLE`. |
| `summary.suppliesDistributed` | The total `quantity` of the distributions counted below. |
| `summary.affectedPeople` | The sum of `currentOccupancy` over all shelters. |
| `shelters` | Every shelter in the district, sorted by `name`. |
| `teams` | Every team in the district, sorted by `name`. |
| `recentDistributions` | The 10 most recent distributions, newest first. |
| `totalsByOrganisation` | One row per organisation with a team, stock or distribution in the district, sorted by organisation `name`. `teams` counts its teams, `stockItems` sums its `quantityAvailable` and `distributed` sums its distributed `quantity`. |

Distributions are counted from the incident's `startDate`, or over all time when there is no active incident.

**Failure — `403 Forbidden`** (a district officer asking for another district)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only coordinate your own district."
  }
}
```

### 13.4 Shelters

#### 13.4.1 List shelters — `GET /api/shelters`

DMS-140. **Roles:** `district_officer` (own district), DMC officers (any district). **Query:** `districtId`, as in 13.3.

**Success — `200 OK`**: `{ "shelters": [ ... ] }`, every shelter object (13.2) in the district, sorted by `name`. No shelters is `200` with `[]`.

#### 13.4.2 Update shelter occupancy — `PATCH /api/shelters/:id/occupancy`

UC03 main flow steps 3–5 (DMS-141), with A2 (DMS-145), E1 (DMS-147) and E2 (DMS-148). Sets how many people are in the shelter now, and keeps a history record of every update for post-event reports (UC04).

**Roles:** `district_officer`, for a shelter in their own district.

**Request body**

| Field | Rule |
|---|---|
| `occupants` | Required. A whole number, 0 or more. 0 is an empty shelter. It may be above `capacity`: nobody is turned away by the software, and the shelter shows as `FULL`. |

```json
{ "occupants": 460 }
```

**Behaviour**
1. Sets the shelter's `currentOccupancy` to `occupants`, and adds an occupancy record (below) to its history. Nothing else about the shelter changes; capacity is not edited here.
2. Recalculates `rate` and `status` with the table in 13.2, on the exact ratio. For a capacity of 500:

   | `occupants` | `rate` | `status` |
   |---|---|---|
   | 0 | 0 | `AVAILABLE` |
   | 370 | 0.74 | `AVAILABLE` |
   | 375 | 0.75 | `FILLING_UP` |
   | 449 | 0.898 | `FILLING_UP` (not rounded up to 90%) |
   | 450 | 0.9 | `NEAR_CAPACITY` |
   | 499 | 0.998 | `NEAR_CAPACITY` |
   | 500 | 1 | `FULL` |
   | 505 | 1.01 | `FULL` |

3. **A2:** when the status is now `NEAR_CAPACITY` or `FULL`, the shelter is **flagged** and the response suggests the nearest other shelter in the same district with spare capacity, by distance between the shelters' locations.
4. **E2:** when no other shelter in the district has spare capacity, there is no suggestion and every DMC officer is notified (13.12). For each district this alert is sent at most once an hour while the condition lasts, and again if space became available in between.

**Success — `200 OK`** (main flow: 380 of 500, not flagged)

```json
{
  "success": true,
  "data": {
    "shelter": {
      "id": "66fb0a1b2c3d4e5f6a7b8c01",
      "name": "Gampaha Central College",
      "capacity": 500,
      "currentOccupancy": 380,
      "rate": 0.76,
      "status": "FILLING_UP",
      "...": "the rest of the shelter object"
    },
    "rate": 0.76,
    "status": "FILLING_UP",
    "flagged": false,
    "alternateShelter": null,
    "dmcAlerted": false
  }
}
```

**Success — `200 OK`** (A2: 460 of 500, flagged, with a suggestion)

```json
{
  "success": true,
  "data": {
    "shelter": { "id": "66fb0a1b2c3d4e5f6a7b8c01", "...": "the shelter object" },
    "rate": 0.92,
    "status": "NEAR_CAPACITY",
    "flagged": true,
    "alternateShelter": {
      "id": "66fb0a1b2c3d4e5f6a7b8c02",
      "name": "Minuwangoda National School",
      "rate": 0.76,
      "status": "FILLING_UP",
      "distanceKm": 3.2
    },
    "dmcAlerted": false
  }
}
```

**Success — `200 OK`** (E2: flagged, and no shelter in the district has space)

```json
{
  "success": true,
  "data": {
    "shelter": { "id": "66fb0a1b2c3d4e5f6a7b8c01", "...": "the shelter object" },
    "rate": 0.92,
    "status": "NEAR_CAPACITY",
    "flagged": true,
    "alternateShelter": null,
    "dmcAlerted": true
  }
}
```

| Field | Notes |
|---|---|
| `shelter` | The updated shelter object (13.2). |
| `rate`, `status` | The same values as `shelter.rate` and `shelter.status`, at the top level for the dialog's indicator, e.g. "(!) 92% – Near capacity". |
| `flagged` | `true` when `status` is `NEAR_CAPACITY` or `FULL`. |
| `alternateShelter` | The suggestion, or `null` when not flagged or when no shelter has spare capacity. `distanceKm` is rounded to one decimal place; the ordering uses the exact distance. |
| `dmcAlerted` | `true` when flagged with no suggestion (E2): the DMC has been alerted, by this update or within the last hour. |

**The occupancy record.** Every successful update stores one record, and nothing else creates them, so a rejected update leaves no trace. UC03 has no endpoint that returns them; post-event reports (UC04) read them directly for "shelter occupancy over time".

| Field | Type | Notes |
|---|---|---|
| `shelter` | shelter id | The shelter the record belongs to. |
| `district` | district id | Copied from the shelter, so UC04 can query by district without a join. |
| `occupants` | integer | The `occupants` sent, 0 or more. |
| `capacity` | integer | The shelter's capacity at that moment, so the rate can be recomputed later even if capacity changes. |
| `recordedAt` | date | When the update was saved. |
| `recordedBy` | user id | The district officer who sent it. |

Records are indexed by `{ shelter, recordedAt }` and `{ district, recordedAt }`.

**Failure — `400 Bad Request`** (E1: not a whole number). Nothing is saved and no occupancy record is created.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "occupants", "message": "must be a whole number, 0 or more" }]
  }
}
```

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `occupants` missing, negative, not a whole number (e.g. `12.5`) or not a number (e.g. `"abc"`). Carries `errors` on `occupants`. |
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | The caller isn't a `district_officer`, or the shelter is in another district. |
| `404` | `NOT_FOUND` | No shelter has this id, or the id isn't valid. |
| `409` | `NO_ACTIVE_INCIDENT` | The shelter's district has no `ACTIVE` hazard event. |

#### 13.4.3 Register a shelter — `POST /api/shelters`

UC03 A1 (DMS-144). Opens a new shelter in the officer's own district, empty and `AVAILABLE`.

**Roles:** `district_officer`. The shelter always goes in their own district; the body has no district.

**Request body**

| Field | Rule |
|---|---|
| `name` | Required. 1–100 characters after trimming. Unique within the district, ignoring case and surrounding spaces. The same name in another district is allowed. |
| `location` | Required. `{ lat, lng, label? }`: `lat` from −90 to 90, `lng` from −180 to 180, `label` up to 200 characters. |
| `capacity` | Required. A whole number, 1 or more. |

```json
{
  "name": "Ja-Ela Central College",
  "location": { "lat": 7.0744, "lng": 79.8919, "label": "Ja-Ela" },
  "capacity": 300
}
```

**Success — `201 Created`**: `{ "shelter": { ... } }`, the new shelter object with `currentOccupancy: 0`, `rate: 0` and `status: "AVAILABLE"`.

**Failure — `409 Conflict`** (the name is taken in this district)

```json
{
  "success": false,
  "error": {
    "code": "SHELTER_NAME_TAKEN",
    "message": "A shelter named \"Ja-Ela Central College\" already exists in Gampaha."
  }
}
```

Also `400 VALIDATION_ERROR` (e.g. `capacity` 0, −5 or 10.5; `name` or `location` missing) and `409 NO_ACTIVE_INCIDENT`.

#### 13.4.4 Redirect new arrivals — `POST /api/shelters/:id/redirects`

UC03 A2.3 (DMS-145). Records that new arrivals at shelter `:id` are sent to another shelter. The dashboard then shows "Redirecting to Minuwangoda National School" on `:id`.

**Roles:** `district_officer`, for a shelter in their own district.

**Request body**

| Field | Rule |
|---|---|
| `toShelterId` | Required. Another shelter in the same district, not `:id` itself. |

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "redirect": {
      "id": "66fb0f1b2c3d4e5f6a7b9101",
      "from": { "id": "66fb0a1b2c3d4e5f6a7b8c01", "name": "Gampaha Central College" },
      "to": { "id": "66fb0a1b2c3d4e5f6a7b8c02", "name": "Minuwangoda National School" },
      "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
      "by": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" },
      "at": "2026-10-03T09:31:00.000Z"
    }
  }
}
```

**Failure — `409 Conflict`** (the target filled up meanwhile)

```json
{
  "success": false,
  "error": {
    "code": "SHELTER_NO_SPACE",
    "message": "Minuwangoda National School has no spare capacity (91%)."
  }
}
```

Also `400 VALIDATION_ERROR` on `toShelterId` (missing, the same shelter, or a shelter in another district), `403 FORBIDDEN`, `404 NOT_FOUND` and `409 NO_ACTIVE_INCIDENT`.

### 13.5 List rescue teams — `GET /api/rescue-teams`

DMS-140. **Roles:** `district_officer` (own district), DMC officers (any district). **Query:** `districtId`, as in 13.3.

**Success — `200 OK`**: `{ "teams": [ ... ] }`, every rescue team object (13.2) in the district, sorted by `name`.

### 13.6 Nearest available teams — `GET /api/rescue-teams/available`

UC03 main flow step 7 (DMS-142), and A3.3 / E4.2 when choosing another team. Lists the district's `AVAILABLE` teams with their owning organisation, nearest to the incident first, for the Dispatch Rescue Team dialog ("Team Alpha · 2.5 km · SL Army").

**Roles:** `district_officer`.

| Query param | Rule |
|---|---|
| `lat` | Required. The incident's latitude, −90 to 90. |
| `lng` | Required. The incident's longitude, −180 to 180. |
| `districtId` | Optional; defaults to, and must be, the officer's own district. |
| `excludeTeamIds` | Optional. Comma-separated team ids to leave out, e.g. the team that just declined (A3.3). |

**Success — `200 OK`** (sorted by distance from each team's `currentLocation`, ties broken by `name`)

```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "id": "66fb0b1b2c3d4e5f6a7b8d01",
        "name": "Team Alpha",
        "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d5", "name": "SL Army", "type": "ARMED_FORCES" },
        "memberCount": 8,
        "status": "AVAILABLE",
        "distanceKm": 2.5,
        "...": "the rest of the rescue team object"
      },
      {
        "id": "66fb0b1b2c3d4e5f6a7b8d05",
        "name": "Team Echo",
        "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d2", "name": "Fire Service", "type": "GOVERNMENT" },
        "memberCount": 6,
        "status": "AVAILABLE",
        "distanceKm": 6.1,
        "...": "the rest of the rescue team object"
      }
    ]
  }
}
```

| Field | Notes |
|---|---|
| `distanceKm` | Straight-line (haversine) distance from the team's `currentLocation` to (`lat`, `lng`), rounded to one decimal place. The ordering uses the exact distance. |

Only `AVAILABLE` teams are listed: `DISPATCHED`, `ON_SITE` and `UNAVAILABLE` teams never are. This is a read, so it works without an active incident.

**E3:** no available team is `200` with `"teams": []`. The dialog then shows "No team available" and offers *Request DMC support* (13.9.1).

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `lat` or `lng` missing or out of range, or a malformed `districtId` or id in `excludeTeamIds`. |
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | The caller isn't a `district_officer`, or `districtId` is another district. |

### 13.7 Dispatches

UC03 main flow steps 6–11 (DMS-142).

#### 13.7.1 Dispatch settings

`DISPATCH_ACK_TIMEOUT_MINUTES` (server environment, a whole number of minutes, default `5`) sets how long a team lead has to acknowledge. The dialog shows it as "Acknowledgement deadline: 5 min".

#### 13.7.2 Dispatch a team — `POST /api/dispatches`

Steps 8–9. Creates an `ASSIGNED` dispatch for an available team, sets the team to `DISPATCHED` and sends the assignment to its lead's field app.

**Roles:** `district_officer`, for a team in their own district.

**Request body**

| Field | Rule |
|---|---|
| `teamId` | Required. A team in the officer's district. |
| `incidentLocation` | Required. `{ lat, lng, label? }`: `lat` from −90 to 90, `lng` from −180 to 180, `label` up to 200 characters, e.g. `"Biyagama – flooded road"`. |
| `priority` | Required. A `Priority`: `LOW`, `MEDIUM`, `HIGH` or `CRITICAL`. The dialog defaults to `HIGH`. |

```json
{
  "teamId": "66fb0b1b2c3d4e5f6a7b8d01",
  "incidentLocation": { "lat": 6.9555, "lng": 79.9865, "label": "Biyagama – flooded road" },
  "priority": "HIGH"
}
```

**Behaviour** (UC03 sequence diagram (b))
1. Moves the team from `AVAILABLE` to `DISPATCHED`, but only if it is still `AVAILABLE` at that moment. If another officer dispatched it first, nothing is created (`409 TEAM_NOT_AVAILABLE`).
2. Creates the dispatch as `ASSIGNED`, for the district's `ACTIVE` hazard event, with `createdAt` now and `ackDeadline = createdAt + DISPATCH_ACK_TIMEOUT_MINUTES`, and a first `statusHistory` entry.
3. Notifies the team's lead (13.12), which puts the assignment in the field app. A team without a lead is still dispatched; nobody is notified. A failed notification never fails the dispatch.

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "dispatch": {
      "id": "66fb0c1b2c3d4e5f6a7b8e01",
      "status": "ASSIGNED",
      "team": {
        "id": "66fb0b1b2c3d4e5f6a7b8d01",
        "name": "Team Alpha",
        "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d5", "name": "SL Army", "type": "ARMED_FORCES" }
      },
      "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
      "incident": { "id": "66f7c1a2b3c4d5e6f7a8b9c1", "name": "Flood – Gampaha District" },
      "incidentLocation": { "lat": 6.9555, "lng": 79.9865, "label": "Biyagama – flooded road" },
      "priority": "HIGH",
      "supportRequested": false,
      "createdBy": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" },
      "createdAt": "2026-10-03T09:30:00.000Z",
      "ackDeadline": "2026-10-03T09:35:00.000Z",
      "declineReason": null,
      "statusHistory": [
        {
          "status": "ASSIGNED",
          "at": "2026-10-03T09:30:00.000Z",
          "by": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" }
        }
      ]
    }
  }
}
```

**Failure — `409 Conflict`** (the team stopped being available, e.g. another officer dispatched it first)

```json
{
  "success": false,
  "error": {
    "code": "TEAM_NOT_AVAILABLE",
    "message": "Team Alpha is DISPATCHED and can't take a new dispatch."
  }
}
```

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `teamId` missing or malformed, `incidentLocation` missing or out of range, or `priority` not a `Priority`. Carries `errors`. |
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | The caller isn't a `district_officer`, or the team is in another district. |
| `404` | `NOT_FOUND` | No team has `teamId`. |
| `409` | `TEAM_NOT_AVAILABLE` | The team is `DISPATCHED`, `ON_SITE` or `UNAVAILABLE`. |
| `409` | `NO_ACTIVE_INCIDENT` | The officer's district has no `ACTIVE` hazard event. |

#### 13.7.3 List dispatches — `GET /api/dispatches`

For the officer console: the unassigned queue (13.9), and the decline and timeout prompts (13.8, 13.10), which poll this list every 15 seconds while the dashboard is open.

**Roles:** `district_officer` (own district), DMC officers (any district).

| Query param | Rule |
|---|---|
| `districtId` | As in 13.3. |
| `status` | Optional. One `DispatchStatus`, or several separated by commas, e.g. `DECLINED,UNRESPONSIVE`. |

**Success — `200 OK`**: `{ "dispatches": [ ... ] }`, dispatch objects newest first, at most 100.

#### 13.7.4 Dispatch detail — `GET /api/dispatches/:id`

**Roles:** `district_officer` (own district), DMC officers (any district), and the lead of the dispatch's team.

**Success — `200 OK`**: `{ "dispatch": { ... } }`.

#### 13.7.5 My assignments — `GET /api/dispatches/mine`

The field app's Assignments tab ("Rescue Team App – Team Alpha"). Answers for the team the caller leads.

**Roles:** `rescue_team_lead`.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "team": { "id": "66fb0b1b2c3d4e5f6a7b8d01", "name": "Team Alpha", "...": "the rescue team object" },
    "dispatches": [
      {
        "id": "66fb0c1b2c3d4e5f6a7b8e01",
        "status": "ASSIGNED",
        "incidentLocation": { "lat": 6.9555, "lng": 79.9865, "label": "Biyagama – flooded road" },
        "priority": "HIGH",
        "ackDeadline": "2026-10-03T09:35:00.000Z",
        "...": "the rest of the dispatch object"
      }
    ]
  }
}
```

`dispatches` holds the team's open dispatches (`ASSIGNED`, `ACKNOWLEDGED`, `ON_SITE`), newest first, followed by its most recently closed one (`COMPLETED`, `DECLINED` or `UNRESPONSIVE`), if any. That way the app can still show "Assignment expired" after a timeout until the next assignment arrives. The app counts down to `ackDeadline` ("respond within 04:32") on an `ASSIGNED` card. A lead who leads no team gets `200` with `"team": null` and `"dispatches": []`.

| Status | Code | When |
|---|---|---|
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | The caller isn't a `rescue_team_lead`. |

#### 13.7.6 Acknowledge — `POST /api/dispatches/:id/acknowledge`

Step 10. `ASSIGNED` → `ACKNOWLEDGED`; the team stays `DISPATCHED` while it travels. No body.

**Roles:** `rescue_team_lead` of the dispatch's team.

An overdue dispatch (13.2) is marked `UNRESPONSIVE` before the action is tried, so acknowledging after the deadline fails with `409`, even if the background check hasn't run yet.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "dispatch": {
      "id": "66fb0c1b2c3d4e5f6a7b8e01",
      "status": "ACKNOWLEDGED",
      "statusHistory": [
        {
          "status": "ASSIGNED",
          "at": "2026-10-03T09:30:00.000Z",
          "by": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" }
        },
        {
          "status": "ACKNOWLEDGED",
          "at": "2026-10-03T09:32:10.000Z",
          "by": { "id": "66f1a2b3c4d5e6f7a8b9c0d3", "name": "Suresh Bandara" }
        }
      ],
      "...": "the rest of the dispatch object"
    }
  }
}
```

**Failure — `409 Conflict`** (e.g. the deadline has passed, so the dispatch is already `UNRESPONSIVE`)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DISPATCH_TRANSITION",
    "message": "This dispatch is UNRESPONSIVE and can't be acknowledged."
  }
}
```

| Status | Code | When |
|---|---|---|
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | The caller isn't a `rescue_team_lead`, or leads another team. |
| `404` | `NOT_FOUND` | No dispatch has this id, or the id isn't valid. |
| `409` | `INVALID_DISPATCH_TRANSITION` | The dispatch isn't `ASSIGNED`, including one that just passed its deadline. |

#### 13.7.7 On site — `POST /api/dispatches/:id/on-site`

Step 11. `ACKNOWLEDGED` → `ON_SITE`. The team becomes `ON_SITE` and its `currentLocation` becomes the incident location. No body.

**Roles, success and failures:** as in 13.7.6, with the dispatch in `ON_SITE`. Going on site from any status but `ACKNOWLEDGED` is `409 INVALID_DISPATCH_TRANSITION`.

#### 13.7.8 Complete — `POST /api/dispatches/:id/complete`

Step 11. `ON_SITE` → `COMPLETED`, and the team returns to `AVAILABLE`, so it is listed again in 13.6. No body.

**Roles, success and failures:** as in 13.7.6, with the dispatch in `COMPLETED`. Completing from any status but `ON_SITE`, e.g. an `ASSIGNED` dispatch, is `409 INVALID_DISPATCH_TRANSITION`.

### 13.8 Decline an assignment — `POST /api/dispatches/:id/decline`

UC03 A3 (DMS-146). `ASSIGNED` → `DECLINED`: the team returns to `AVAILABLE`, and the officer who created the dispatch is notified (13.12) to choose another team. The console then requests 13.6 again with `excludeTeamIds` set to the declining team.

**Roles:** `rescue_team_lead` of the dispatch's team.

**Request body**

| Field | Rule |
|---|---|
| `reason` | Required. 1–200 characters after trimming, e.g. `"Vehicle unavailable"`. |

**Success — `200 OK`**: `{ "dispatch": { ... } }`, with `declineReason` set.

**Failures:** `400 VALIDATION_ERROR` on `reason`, `403 FORBIDDEN`, and `409 INVALID_DISPATCH_TRANSITION` when the dispatch is no longer `ASSIGNED` (e.g. already acknowledged).

### 13.9 Unassigned queue

UC03 E3 (DMS-149): no team is available, so the incident waits in the district's unassigned queue (`GET /api/dispatches?status=UNASSIGNED`).

#### 13.9.1 Queue an incident — `POST /api/dispatches/unassigned`

Creates an `UNASSIGNED` dispatch with no team. When `supportRequested` is `true`, every DMC officer is notified (13.12).

**Roles:** `district_officer`.

| Field | Rule |
|---|---|
| `incidentLocation` | Required, as in 13.7.2. |
| `priority` | Required, as in 13.7.2. |
| `supportRequested` | Optional boolean, default `true`. |

**Success — `201 Created`**: `{ "dispatch": { ... } }`, `UNASSIGNED`, with `team: null` and `ackDeadline: null`.

**Failures:** `400 VALIDATION_ERROR` and `409 NO_ACTIVE_INCIDENT`.

#### 13.9.2 Assign a team — `POST /api/dispatches/:id/assign`

`UNASSIGNED` → `ASSIGNED` once a team is free; the flow then continues as after 13.7.2, with a deadline counted from now.

**Roles:** `district_officer`, for a dispatch in their own district.

| Field | Rule |
|---|---|
| `teamId` | Required. An `AVAILABLE` team in the same district. |

**Success — `200 OK`**: `{ "dispatch": { ... } }`.

**Failures:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 TEAM_NOT_AVAILABLE`, `409 INVALID_DISPATCH_TRANSITION` (the dispatch isn't `UNASSIGNED`) and `409 NO_ACTIVE_INCIDENT`.

### 13.10 Acknowledgement timeout and team availability

UC03 E4 (DMS-150). An overdue dispatch (13.2) becomes `UNRESPONSIVE`, its team becomes `UNAVAILABLE`, and the officer who created it is notified (13.12) to reassign. The team stays out of the available list until an officer marks it available again.

#### 13.10.1 Mark a team available — `POST /api/rescue-teams/:id/availability`

`UNAVAILABLE` → `AVAILABLE`. No body. A team that is already `AVAILABLE` is returned unchanged.

**Roles:** `district_officer`, for a team in their own district.

**Success — `200 OK`**: `{ "team": { ... } }`.

**Failure — `409 Conflict`** (the team is out on a dispatch)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TEAM_TRANSITION",
    "message": "Team Alpha is ON_SITE; it becomes available when its dispatch is completed."
  }
}
```

Also `403 FORBIDDEN`, `404 NOT_FOUND` and `409 NO_ACTIVE_INCIDENT`.

### 13.11 Relief supplies

UC03 main flow steps 12–13 (DMS-143), with E5 (DMS-151). What an organisation **holds** (relief stock) is kept apart from what was **given** to a shelter (a supply distribution); logging a distribution moves quantity from the first to the second.

#### 13.11.1 List relief stock — `GET /api/relief-stock`

Feeds the Log Relief Supply dialog: its Owner organisation and Supply type selects, and the read-only "Available stock 1,200 bottles".

**Roles:** `district_officer` (own district), DMC officers (any district).

| Query param | Rule |
|---|---|
| `districtId` | As in 13.3. |
| `organisationId` | Optional. One organisation's stock only. A malformed id → `400 VALIDATION_ERROR`; an unknown one returns `[]`. |
| `supplyType` | Optional. One `SupplyType` only. Any other value → `400 VALIDATION_ERROR` on `supplyType`. |

**Success — `200 OK`** (sorted by organisation `name`, then `supplyType`)

```json
{
  "success": true,
  "data": {
    "stock": [
      {
        "id": "66fb0d1b2c3d4e5f6a7b8f02",
        "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
        "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
        "supplyType": "FOOD",
        "unit": "packs",
        "quantityAvailable": 0,
        "updatedAt": "2026-10-03T08:00:00.000Z"
      },
      {
        "id": "66fb0d1b2c3d4e5f6a7b8f01",
        "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
        "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
        "supplyType": "WATER",
        "unit": "bottles",
        "quantityAvailable": 1200,
        "updatedAt": "2026-10-03T08:00:00.000Z"
      }
    ]
  }
}
```

Rows with nothing left are included, showing `0`, so the dialog can say so rather than hide the organisation. No stock is `200` with `[]`.

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `districtId` missing for a DMC officer, or a malformed `districtId` / `organisationId`, or an unknown `supplyType`. |
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | A role other than `district_officer` or a DMC officer, or a district officer asking for another district. |

#### 13.11.2 Log a distribution — `POST /api/supply-distributions`

Records that a quantity of one stock row went to a shelter, and reduces the stock by it. Two logs can never overdraw the same stock between them: the stock is reduced only if enough remains at that moment.

**Roles:** `district_officer`, for a shelter and a stock row in their own district.

**Request body**

| Field | Rule |
|---|---|
| `shelterId` | Required. The receiving shelter, in the officer's district. |
| `stockId` | Required. The stock row it comes from, in the officer's district. It fixes the owner organisation and the supply type. |
| `quantity` | Required. A whole number from 1 to the stock's `quantityAvailable`, counted in the stock's `unit`. |

```json
{ "shelterId": "66fb0a1b2c3d4e5f6a7b8c01", "stockId": "66fb0d1b2c3d4e5f6a7b8f01", "quantity": 500 }
```

**Behaviour** (UC03 sequence diagram (c))
1. Finds the stock row and the shelter, and checks both are in the officer's district.
2. Checks `quantity` against the stock's `quantityAvailable` (E5, below).
3. Reduces `quantityAvailable` by `quantity`, but only if at least `quantity` is still there at that moment. If another log took it first, nothing changes and the request fails as in E5, with the available quantity re-read.
4. Records the distribution (below), stamped with the current time and the officer.

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "distribution": {
      "id": "66fb0e1b2c3d4e5f6a7b9001",
      "shelter": { "id": "66fb0a1b2c3d4e5f6a7b8c01", "name": "Gampaha Central College" },
      "stockId": "66fb0d1b2c3d4e5f6a7b8f01",
      "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
      "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
      "supplyType": "WATER",
      "unit": "bottles",
      "quantity": 500,
      "distributedAt": "2026-10-03T10:15:00.000Z",
      "loggedBy": { "id": "66f1a2b3c4d5e6f7a8b9c0d6", "name": "Dilani Wickramasinghe" }
    },
    "stock": {
      "id": "66fb0d1b2c3d4e5f6a7b8f01",
      "organisation": { "id": "66f7c1a2b3c4d5e6f7a8b9d4", "name": "Red Cross Sri Lanka", "type": "NGO" },
      "district": { "id": "66f7c1a2b3c4d5e6f7a8b902", "name": "Gampaha" },
      "supplyType": "WATER",
      "unit": "bottles",
      "quantityAvailable": 700,
      "updatedAt": "2026-10-03T10:15:00.000Z"
    }
  }
}
```

`stock` is the row after the withdrawal, so the dialog can show the new available quantity without another request. A `quantity` equal to everything available is allowed and leaves `0`.

**The distribution record.** Each successful log stores one record; a rejected log stores none. Post-event reports (UC04) read these directly for "resource distribution by district".

| Field | Type | Notes |
|---|---|---|
| `shelter` | shelter id | The receiving shelter. |
| `stock` | stock id | The stock row it was drawn from. |
| `organisation` | organisation id | Copied from the stock row: the owner of what was given. |
| `supplyType` | `SupplyType` | Copied from the stock row. |
| `district` | district id | Copied from the stock row. |
| `quantity` | integer | 1 or more, in the stock's `unit`. |
| `distributedAt` | date | When the log was saved. |
| `loggedBy` | user id | The district officer who logged it. |

Records are indexed by `{ district, distributedAt }` and `{ organisation }`.

**Failure — `400 Bad Request`** (E5: more than the stock holds). The message shows the available quantity at the moment of the request, also when another log took the stock first. The stock is unchanged and nothing is recorded.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "quantity", "message": "must be between 1 and 1200 (available)" }]
  }
}
```

When nothing is left, the message is `"no stock available (0 bottles)"`.

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | A field is missing or malformed; `quantity` is 0 or less or not a whole number; or `quantity` is more than the stock holds (E5). Carries `errors`, one entry per field. |
| `401` | `AUTH_HEADER_MISSING`, `AUTH_HEADER_MALFORMED`, `TOKEN_EXPIRED`, `TOKEN_INVALID` | As in 13.13. |
| `403` | `FORBIDDEN` | The caller isn't a `district_officer`, or the shelter or stock row is in another district. |
| `404` | `NOT_FOUND` | No shelter has `shelterId`, or no stock row has `stockId`. |
| `409` | `NO_ACTIVE_INCIDENT` | The officer's district has no `ACTIVE` hazard event. |

### 13.12 Notifications sent

Inbox notifications (§11), one per recipient.

| When | Recipients | `type` (§11.1) | Text |
|---|---|---|---|
| A team is dispatched (13.7.2) or assigned (13.9.2) | The team's lead | `ASSIGNMENT` | "New assignment – Biyagama – flooded road (HIGH). Respond within 5 min." Links to the dispatch. |
| A lead declines (13.8) | The officer who created the dispatch | `DISPATCH_DECLINED` | "Team Alpha declined (Vehicle unavailable) – choose another team" |
| A dispatch times out (13.10) | The officer who created the dispatch | `DISPATCH_UNRESPONSIVE` | "No response from Team Alpha – reassign" |
| No shelter with space (13.4.2, E2) | Every DMC officer | `SHELTER_CAPACITY` | "All shelters in Gampaha are near capacity or full (Gampaha Central College 92%)" |
| Support requested (13.9.1, E3) | Every DMC officer | `SUPPORT_REQUEST` | "Gampaha requests rescue support – Biyagama – flooded road, HIGH" |

A failed notification never fails the request that triggered it.

### 13.13 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | A body or query field failed its rule, including a quantity above the available stock (13.11.2). Carries `errors`, one entry per field. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `403` | `FORBIDDEN` | The caller's role isn't admitted, the record or `districtId` is in another district, or a lead acts on another team's dispatch (13.1). |
| `404` | `NOT_FOUND` | The shelter, team, stock row or dispatch doesn't exist, or the id isn't valid. |
| `409` | `NO_ACTIVE_INCIDENT` | An officer write while the district has no `ACTIVE` hazard event. |
| `409` | `SHELTER_NAME_TAKEN` | Registering a shelter whose name is already used in the district. |
| `409` | `SHELTER_NO_SPACE` | Redirecting to a shelter without spare capacity. |
| `409` | `TEAM_NOT_AVAILABLE` | Dispatching or assigning a team that isn't `AVAILABLE`. |
| `409` | `INVALID_DISPATCH_TRANSITION` | A dispatch action its current status doesn't allow (13.2). |
| `409` | `INVALID_TEAM_TRANSITION` | Marking available a team that is `DISPATCHED` or `ON_SITE`. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

---

## 14. Post-event reports endpoints

Reserved for UC04 Generate Post-Event Analysis Report (DMS-153). The section, with its **Analytics data** subsection, follows in its own PR, approved by the owners of the data it reads. It reads only these frozen shapes:

- Hazard alerts: the alert object (§12.1) and the delivery record (§12.9).
- Coordination: the occupancy record (§13.4.2) and the distribution record (§13.11.2).
- Hazard events (§8) and organisations (§10).

---

## 15. Adding a new endpoint later

1. Pick a plural, lowercase, hyphenated resource name.
2. Reuse the envelopes in sections 2 and 3 exactly — don't invent a new outer shape.
3. Reuse an existing error `code` if the failure matches one in the table in section 3; add a new row to that table if it genuinely doesn't.
4. Document the endpoint here (method, path, request body, success and failure examples) before implementing it.
5. After `contract-freeze-1`, changing a documented endpoint or data field — its path, request, response, error codes or stored fields — needs a PR approved by every consumer of it. Run `git diff contract-freeze-1 -- docs/api-contract.md` to see what changed since the freeze.
