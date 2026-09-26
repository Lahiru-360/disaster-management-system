This is where express code exists (Back-end)

## Setup

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI` (ask a teammate for the shared Atlas connection string — never commit this file).
2. Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_BUCKET_NAME` the same way — ask a teammate for the shared Supabase project credentials. The API fails loudly on startup if any of these three are missing, rather than only failing the first time something tries to upload a file.
3. `npm install`
4. `npm run dev`

## Testing

`npm test` runs the full Jest + Supertest suite once and exits — no watch mode, no `.env` required.

- Tests run against an in-memory MongoDB instance (`mongodb-memory-server`), spun up once for the whole run in `tests/setup.js`. They never connect to the shared Atlas cluster, so running the suite is always safe.
- `tests/setup.js` also clears every collection after each test, so tests don't leak state into one another and the suite passes regardless of run order.
- Test files live in `tests/integration/*.test.js`, one file per endpoint group (e.g. `auth.register.test.js`, `auth.login.test.js`, `auth.tokens.test.js`, `auth.rbac.test.js`).

**Adding a new test**

1. Add a `*.test.js` file under `tests/integration/` (or a new subfolder if it's a different area of the API).
2. Import the app with `import { app } from '../../src/core/App.js'` — never `src/server.js`. `server.js` starts a `Server`, which connects to the database and calls `app.listen`, leaving the process hanging after the suite finishes; Supertest binds its own ephemeral port from the `app` instance directly.
3. Drive the endpoint with `supertest`, e.g. `await request(app).post('/api/auth/login').send({ ... })`, and assert on `res.status` / `res.body`.
4. If the test needs a user that can't be created through the public API (e.g. an `admin`), create it directly with the Mongoose model (`User.create(...)`) — the same restriction applies in tests as in production, so this is the intended workaround, not a hack.
5. To simulate an expired token, sign one directly with `jsonwebtoken` using a negative `expiresIn` instead of waiting for a real token to expire (see `auth.tokens.test.js`).
6. Run `npm test` to confirm it passes, then check it also passes with `node --experimental-vm-modules node_modules/jest/bin/jest.js --randomize` if it depends on data another test might create, to make sure ordering isn't accidentally required.

## Deployed dev environment

The API is deployed from `dev-release` to Render, auto-deploying on every push.

- **Public URL**: `https://<your-render-service>.onrender.com`
- **Dashboard**: `https://dashboard.render.com/web/<your-service-id>`
- **Health check**: `https://<your-render-service>.onrender.com/api/health`

### Adding an environment variable

In the dashboard, go to **Environment** in the left sidebar, add the key/value pair, and save — Render redeploys automatically to apply it. Never commit secrets to `.env`; they're set through the dashboard only.

### Cold starts

This is a free-tier instance, so it sleeps after periods of inactivity. The first request after a quiet period can take several seconds to respond while the instance spins back up — this is expected, not a bug.

## Seeding test data

`npm run seed` creates one test user per role against the shared cluster. It is idempotent — an existing user (matched by email) is left untouched, so running it repeatedly never creates duplicates.

| Role     | Email                 | Password     |
| -------- | --------------------- | ------------ |
| seeker   | seeker@example.test   | Password123! |
| business | business@example.test | Password123! |
| admin    | admin@example.test    | Password123! |

These are dev/test-only credentials for the shared cluster, not real accounts. `admin` is only ever created this way or by direct database access — never through public registration.

## Auth middleware — protecting a route

`requireAuth` and `requireRole` are methods of the shared `authMiddleware` instance in `src/middleware/AuthMiddleware.js`; they are bound to it, so pass them to a route directly. `requireAuth` verifies the bearer token, loads the user from the database, and attaches it to `req.user`. `requireRole` is a factory that must run **after** `requireAuth` — it checks `req.user.role` against the roles you pass in.

- `requireAuth` alone → any authenticated user, any role.
- `requireAuth` + `requireRole("business")` → businesses only.
- `requireAuth` + `requireRole("business", "admin")` → either role.
- `requireRole` used without `requireAuth` first fails closed with `401 UNAUTHENTICATED` — it never trusts a missing `req.user`.

Routes are declared inside a routes class's `registerRoutes(router)` (see `src/routes/AuthRoutes.js`), with `authMiddleware` imported from `'../middleware/AuthMiddleware.js'`.

**Any authenticated user:**

```js
router.get('/me', authMiddleware.requireAuth, authController.me);
```

**Business-only route:**

```js
router.post(
  '/items',
  authMiddleware.requireAuth,
  authMiddleware.requireRole('business'),
  itemController.create,
);
```

**Admin-only route:**

```js
router.post(
  '/businesses/:id/verify',
  authMiddleware.requireAuth,
  authMiddleware.requireRole('admin'),
  businessController.verify,
);
```

**Error codes from `requireAuth`** (all `401`, distinct `code` so the client knows when to trigger a refresh vs. show a login screen):

| Code                    | Meaning                                                |
| ----------------------- | ------------------------------------------------------ |
| `AUTH_HEADER_MISSING`   | No `Authorization` header sent                         |
| `AUTH_HEADER_MALFORMED` | Header isn't `Bearer <token>`                          |
| `TOKEN_INVALID`         | Bad signature, malformed JWT, or user no longer exists |
| `TOKEN_EXPIRED`         | Token signature is valid but it has expired            |

`requireRole` responds `401 UNAUTHENTICATED` if reached with no `req.user`, and `403 FORBIDDEN` if the user's role isn't allowed.

## Schema conventions

Follow this pattern for every new model.

**Naming and location**

- One file per collection at `src/models/<Entity>.js`, singular PascalCase entity name (e.g. `Item.js`, not `Items.js`).
- The model is a class that extends `mongoose.Model`, exported under the entity's name, e.g. `export class Item extends mongoose.Model {}`.
- Register it with `mongoose.connection.model(Item, itemSchema)`, **not** `mongoose.model(Item, itemSchema)`: given a class, Mongoose 9's `mongoose.model()` registers it under the class's source text instead of its name, which breaks lookups by name such as `ref: 'Item'` and `.populate()`.
- Keep models thin — the schema is the model. Business logic belongs in a service.
- A collection of tokens owned by a user and deleted on expiry extends `ExpiringToken`, which supplies the shared `user` and TTL `expiresAt` field definitions (see `RefreshToken.js`).

**Field conventions**

- Enable `timestamps: true` on every schema (adds `createdAt`/`updatedAt`) unless there's a specific reason not to.
- References between collections are `mongoose.Schema.Types.ObjectId` with a `ref`, never embedded copies — this keeps `.populate()` consistent across features.
- Enum fields (like `role`) use a fixed `enum` array, not a free string, so invalid values are rejected at the schema level.
- Never store secrets (passwords, tokens) in plaintext — only their hash, and only in fields explicitly named for it (e.g. `passwordHash`).

**Indexes**

- Declare indexes inline on the field, not in a separate `schema.index()` call, unless the index is compound or the options don't fit a single field (e.g. `unique: true` for a unique index, `expires: <seconds>` for a TTL index on a `Date` field).
- Any field that must be unique across the collection (e.g. `email`) needs `unique: true` in its schema definition.

**Sensitive data in responses**

- If a model holds sensitive fields (password hashes, internal flags), add a `toJSON` transform in the schema options that deletes them, plus `__v`, before the document is ever serialized. See `User.js` for the pattern.

**Example skeleton**

```js
import mongoose from 'mongoose';

const exampleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      required: true,
    },
  },
  { timestamps: true },
);

export class Example extends mongoose.Model {}

mongoose.connection.model(Example, exampleSchema);
```
