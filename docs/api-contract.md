# Disaster Management System API Contract

**Purpose:** the single source of truth for how every endpoint in this project looks — the shape of a request, the shape of a response, and what each status code means here. Client code is written against this document, not against whichever server behavior happens to exist yet. If a real endpoint disagrees with this document, the endpoint is wrong.

This contract covers the auth, upload, areas, hazard events and organisations endpoints in full, and drafts the hazard reports endpoints (§9), the notifications endpoints (§11) and the hazard alerts endpoints (§12). New endpoints are added under these same conventions — they get their own sections when specified, not their own rules.

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
| `REPORT_ALREADY_REVIEWED` | **Proposed (DMS-112).** Confirm or dismiss on a hazard report that is no longer `PENDING` (§9.6–9.7). Always `409`; the message names the current status. |
| `INVALID_ALERT_TRANSITION` | **Proposed (DMS-112).** An action a hazard alert's current status doesn't allow, e.g. previewing or editing an alert that is no longer `DRAFT` (§12.3–12.4). Always `409`; the message names the current status. |

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

Both endpoints are read-only reference data, seeded by `npm run seed`. **Provisional:** `hazardType` here reuses UC01's `AlertHazardType` enum (`FLOOD`, `LANDSLIDE`, `CYCLONE`, `DROUGHT`); confirmed at the contract freeze (DMS-112) once DMS-120.2 lands. Opening and closing an event is seed-only in this phase — no endpoint here creates, updates or closes one.

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

**Failure — `401 Unauthorized`** — same codes as §7.3.

---

## 9. Hazard reports endpoints

> **Draft (DMS-130.1)** — not frozen until the DMS-112 review. New codes here are proposals.

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
| `409` | `REPORT_ALREADY_REVIEWED` | **Proposed (DMS-112).** Confirm or dismiss on a report that is no longer `PENDING`. |
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

**Failure — `401 Unauthorized`** — same codes as §7.3.

---

## 11. Notifications endpoints

> **Draft (DMS-106.1)** — not frozen until the DMS-112 review.

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

> **Draft (DMS-120.1)** — not frozen until the DMS-112 review. New codes here are proposals.

UC01 Issue Hazard Warning. An officer composes a location-specific warning, previews how many citizens it will reach and what they will read, and then broadcasts it (DMS-121). This section covers **composing** (UC01 main flow steps 1–8): starting a draft, previewing it, saving an edited message and reading an alert back. **Nothing in this section sends anything**, and no delivery record exists while an alert is `DRAFT`.

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
| `status` | enum | `DRAFT` → `BROADCAST` → `UPDATED` (each update) → `CANCELLED` (all-clear) (`AlertStatus`). `BROADCAST` and `UPDATED` are *active*. Everything in this section only ever sees `DRAFT`. |
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

**Failure — `401 Unauthorized`** — see 12.6.

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

**Failure — `404 Not Found`** and **`403 Forbidden`** — see 12.6.

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

**Failure — `404 Not Found`** and **`403 Forbidden`** — see 12.6.

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

### 12.6 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | A body field failed its rule, or `areaIds` names an area that isn't registered. Carries `errors`, one entry per field. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists or has been deactivated. |
| `403` | `FORBIDDEN` | The caller isn't a `dmc_officer` or `duty_officer`. |
| `404` | `NOT_FOUND` | The alert doesn't exist, or the id isn't valid. |
| `409` | `INVALID_ALERT_TRANSITION` | **Proposed (DMS-112).** Preview or save-message on an alert that is no longer `DRAFT`. |
| `500` | `INTERNAL_ERROR` | Unhandled server-side failure. |

---

## 13. Adding a new endpoint later

1. Pick a plural, lowercase, hyphenated resource name.
2. Reuse the envelopes in sections 2 and 3 exactly — don't invent a new outer shape.
3. Reuse an existing error `code` if the failure matches one in the table in section 3; add a new row to that table if it genuinely doesn't.
4. Document the endpoint here (method, path, request body, success and failure examples) before implementing it.
