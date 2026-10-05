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
4. If the test needs a user that can't be created through the public API (any seeded role, e.g. a `dmc_officer`), create it directly with the model — `createUser({ role })` from `tests/helpers/userFactory.js` does this. The same restriction applies in tests as in production, so this is the intended workaround, not a hack.
5. To simulate an expired token, use `expiredBearerFor(user)` from `tests/helpers/authHelper.js` instead of waiting for a real token to expire.
6. Run `npm test` to confirm it passes, then check it also passes with `node --experimental-vm-modules node_modules/jest/bin/jest.js --randomize` if it depends on data another test might create, to make sure ordering isn't accidentally required.

**Shared helpers (`tests/helpers/`)**

Use these instead of writing your own setup, so every use case's tests read the same way (see `tests/integration/auth.rbac.test.js`). They live under `tests/`, never `src/`, so they don't count towards coverage; `tests/unit/testHelpers.test.js` checks them.

| Helper            | Gives you                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `userFactory.js`  | `createUser({ role, homeDistrict, district, shiftDistrict, ...fields })`: a saved `User` in any role, with a unique email. Districts may be documents or ids. Defaults to a citizen.                     |
| `authHelper.js`   | `bearerFor(user)` for the `Authorization` header, `expiredBearerFor(user)` for the `TOKEN_EXPIRED` path, and `accessTokenFor(user, { expiresIn })` for the raw JWT. Signed like `TokenService`.          |
| `areaFixtures.js` | `seedAreas()`: Colombo, Gampaha and Kalutara plus the Kelani basin over Colombo and Gampaha. `AREAS` holds their centroids and boxes (the same as `DistrictSeeder`) for distance assertions.             |
| `FakeClock.js`    | `new FakeClock(start)` with `now()`, `advance(ms)` and `set(time)`, plus `FakeClock.MINUTE` / `HOUR` / `DAY`. Pass it where a service takes `clock = systemClock` (`src/utils/SystemClock.js`).          |
| `FakeChannel.js`  | A `NotificationChannel` whose results you script with `willReturn([{ status: 'FAILED', reason }, new Error('down'), ...])`; once the script runs out it delivers. Every notification sent is in `calls`. |

```js
const { colombo } = await seedAreas();
const officer = await createUser({ role: Role.DUTY_OFFICER, shiftDistrict: colombo });
const res = await request(app).get('/api/hazard-reports').set('Authorization', bearerFor(officer));
```

**Coverage**

Coverage is measured per use case: each owner registers their own files and gets their own number, which must stay at **80% lines and 80% branches** or more.

| Command                                   | What it does                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:coverage`                   | Runs the full suite with coverage over `src/`, leaving out `src/server.js`, `src/core/Server.js` and `src/config/`. Prints a table and writes `coverage/lcov-report/index.html` and `coverage/coverage-summary.json`.                       |
| `npm run coverage:gate`                   | Run after `test:coverage`. For each use case, adds up the lines and branches of its registered files and fails if either total is below 80%.                                                                                                |
| `npm run coverage:uc01` … `coverage:uc04` | Runs the full suite but reports only that use case's files (written to `coverage/uc0X/`), then applies the same 80% check. This is the number for your report. Extra Jest flags go after `--`, e.g. `npm run coverage:uc03 -- --runInBand`. |

CI runs `test:coverage` and then `coverage:gate` on every PR, and attaches `coverage-summary.json` to the run as the `server-coverage-summary` artifact.

**Registering your files.** In the same PR that adds them, add globs (relative to `server/`) to your use case's list in `coverage-scopes.json`, e.g. `"uc03": ["src/domain/coordination/**/*.js", "src/services/ShelterService.js"]`. A leading `!` excludes, as in Jest's `collectCoverageFrom`. Only edit your own use case's list. The gate skips a use case with an empty list, and fails one whose globs match no file, so a typo can't hide your files.

**Running coverage without your `.env`.** npm scripts run inside `server/`, so they load `server/.env`. If yours sets `EMAIL_TRANSPORT=brevo`, the email tests fail and the password-reset tests call Brevo for real. Run from the repo root instead, which has no `.env`:

```bash
node server/scripts/coverageScope.js uc03
node --experimental-vm-modules server/node_modules/jest/bin/jest.js --config server/jest.config.js --rootDir server --coverage
node server/scripts/checkCoverage.js
```

## Deployed dev environment

The API is deployed from `dev-release` to Render, auto-deploying on every push.

- **Public URL**: `https://<your-render-service>.onrender.com`
- **Dashboard**: `https://dashboard.render.com/web/<your-service-id>`
- **Health check**: `https://<your-render-service>.onrender.com/api/health`

### Adding an environment variable

In the dashboard, go to **Environment** in the left sidebar, add the key/value pair, and save — Render redeploys automatically to apply it. Never commit secrets to `.env`; they're set through the dashboard only.

### Cold starts

This is a free-tier instance, so it sleeps after periods of inactivity. The first request after a quiet period can take several seconds to respond while the instance spins back up — this is expected, not a bug.

## Seeding demo accounts

`npm run seed` creates one demo account per role against the shared cluster, all with the password `Password123!`. It is idempotent — an existing user (matched by email) keeps its name, role and password, so running it repeatedly never creates duplicates. Only the profile fields (districts, phone) are set again on every run, so an account seeded before they existed picks them up.

Before the accounts, it also seeds the geography every feature works "by district" against: the 25 districts of Sri Lanka and 8 river basins (`scripts/DistrictSeeder.js`). They are matched by name and updated in place, so a corrected coordinate reaches the database on the next seed.

| Role                  | Name                  | Email                         | District                | Client     |
| --------------------- | --------------------- | ----------------------------- | ----------------------- | ---------- |
| `citizen`             | Nimal Perera          | citizen@example.test          | `homeDistrict` Colombo  | Mobile app |
| `community_volunteer` | Kamala Fernando       | volunteer@example.test        | `homeDistrict` Colombo  | Mobile app |
| `rescue_team_lead`    | Suresh Bandara        | rescue.lead@example.test      | — (via Team Alpha)      | Mobile app |
| `dmc_officer`         | Ruwan Jayasinghe      | dmc.officer@example.test      | — (national)            | Web portal |
| `duty_officer`        | Kasun Silva           | duty.officer@example.test     | `shiftDistrict` Colombo | Web portal |
| `district_officer`    | Dilani Wickramasinghe | district.officer@example.test | `district` Gampaha      | Web portal |

The rescue team lead has no district of their own: they belong to a district through their team (Team Alpha, Gampaha), which the UC03 seeding attaches.

After the demo accounts it adds **500 synthetic citizens** (`scripts/SyntheticCitizenGenerator.js`), so that "how many citizens does this alert reach" gives a realistic number. They are `citizen.synth.<n>@example.test` (n = 1–500) with deterministic names and phones, spread over 8 districts and weighted towards the demo districts: Colombo 150, Gampaha 120, Kalutara 60, Kandy 50, Galle 40, Ratnapura 30, Kurunegala 30, Matara 20. They share the demo password but aren't meant for signing in.

These are dev/test-only credentials for the shared cluster, not real accounts. Only `citizen` and `community_volunteer` can register through the public API; the other four roles are only ever created this way or by direct database access.

The mobile app's login screen has a one-tap picker for the three mobile accounts, driven by `app/src/constants/demoUsers.js`. Keep that list and `scripts/PeopleSeeder.js` in step.

Seeding never removes anything, so an account whose role is no longer in `Role` stays in the cluster until someone deletes it. Every `requireRole` check refuses it with `403`.

## Roles and the Person classes

Every account is one `User` document (the model stays flat) with a `role` string from `src/enums/Role.js`. The role hierarchy is the class hierarchy in `src/domain/people/`:

```
Person (abstract)            name, phone, nic
├── Citizen                  citizen — self-registrable, homeDistrict
│   └── CommunityVolunteer   community_volunteer — trainingLevel
├── DMCOfficer               dmc_officer
│   └── DutyOfficer          duty_officer — shiftDistrict
├── DistrictOfficer          district_officer — district
└── RescueTeamLead           rescue_team_lead
```

- Each class names its role in `static role`. A subclass has everything its parent is allowed because it _is_ an instance of the parent — that is the only statement of the hierarchy.
- `PersonFactory` maps a role string to its class (`classFor`) and a `User` document to a `Person` (`fromUser`). It holds only the list of classes, so there is no separate parent map to keep in step with them.
- `static selfRegistrable` marks the roles public registration accepts. `Citizen` sets it and `CommunityVolunteer` inherits it; `AuthValidator` reads the list from `PersonFactory.selfRegistrableRoles()`.
- `User` stores `name` and the optional profile fields `phone`, `homeDistrict`, `district` and `shiftDistrict` (the last three are refs to `District`; `homeDistrict` and `shiftDistrict` are indexed for recipient and duty-officer lookups). `fromUser` passes them on and each class keeps its own: `Citizen.homeDistrict` (so `CommunityVolunteer` too), `DistrictOfficer.district`, `DutyOfficer.shiftDistrict`. A district comes through as stored — an ObjectId, or the `District` document if the caller populated it.
- All four profile fields are optional: registration doesn't set them, and accounts created before they existed still load. `nic` and `trainingLevel` exist on the classes but are not stored, so they are `undefined` on a `Person` built by `fromUser`.
- To add a role: add its value to `Role`, write its class extending whichever role it specialises, and add the class to `PersonFactory`'s list. `tests/unit/people.test.js` fails if a `Role` value has no class, or two classes claim the same role.

## Auth middleware — protecting a route

`requireAuth` and `requireRole` are methods of the shared `authMiddleware` instance in `src/middleware/AuthMiddleware.js`; they are bound to it, so pass them to a route directly. `requireAuth` verifies the bearer token, loads the user from the database, and attaches it to `req.user`. `requireRole` is a factory that must run **after** `requireAuth` — it builds the user's `Person` with `PersonFactory.fromUser` and admits them if it is an `instanceof` any of the listed roles' classes.

- `requireAuth` alone → any authenticated user, any role.
- `requireAuth` + `requireRole(Role.CITIZEN)` → citizens **and** community volunteers (a `CommunityVolunteer` is a `Citizen`).
- `requireAuth` + `requireRole(Role.COMMUNITY_VOLUNTEER)` → community volunteers only; a plain citizen gets `403`.
- `requireAuth` + `requireRole(Role.DISTRICT_OFFICER, Role.DMC_OFFICER)` → district officers, DMC officers and duty officers.
- `requireRole` used without `requireAuth` first fails closed with `401 UNAUTHENTICATED` — it never trusts a missing `req.user`.
- An unknown role name, e.g. `requireRole('typo')`, throws when the route is declared, so the server fails at startup rather than on the first request.

Routes are declared inside a routes class's `registerRoutes(router)` (see `src/routes/AuthRoutes.js`), with `authMiddleware` imported from `'../middleware/AuthMiddleware.js'` and `Role` from `'../enums/Role.js'`.

**Any authenticated user:**

```js
router.get('/me', authMiddleware.requireAuth, authController.me);
```

**Citizen route (community volunteers included):**

```js
router.post(
  '/hazard-reports',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(Role.CITIZEN),
  hazardReportController.create,
);
```

**DMC officer route (duty officers included):**

```js
router.post(
  '/warnings',
  authMiddleware.requireAuth,
  authMiddleware.requireRole(Role.DMC_OFFICER),
  warningController.issue,
);
```

**Error codes from `requireAuth`** (all `401`, distinct `code` so the client knows when to trigger a refresh vs. show a login screen):

| Code                    | Meaning                                                |
| ----------------------- | ------------------------------------------------------ |
| `AUTH_HEADER_MISSING`   | No `Authorization` header sent                         |
| `AUTH_HEADER_MALFORMED` | Header isn't `Bearer <token>`                          |
| `TOKEN_INVALID`         | Bad signature, malformed JWT, or user no longer exists |
| `TOKEN_EXPIRED`         | Token signature is valid but it has expired            |

`requireRole` responds `401 UNAUTHENTICATED` if reached with no `req.user`, and `403 FORBIDDEN` if the user's role is neither listed nor a subclass of a listed role — including a role that has no class at all.

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
- Enum fields (like `role`) take a fixed `enum` array, not a free string, so invalid values are rejected at the schema level. Take the values from a frozen enum in `src/enums/` (e.g. `enum: Object.values(Role)`) rather than repeating the strings.
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
