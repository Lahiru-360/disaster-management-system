# Disaster Management System — Project Structure

**Purpose:** the agreed shape of the repository. Feed this to an agent working a sub-task so it puts files in the right place, and use it as the team reference so four people don't invent four layouts.

---

## Repository root

```
disaster-management-system/
├── .github/
│   └── workflows/
│       └── ci.yml                          lint + test on PRs to develop/main
│
├── .husky/
│   └── pre-commit                          lint-staged on staged files only
│
├── docs/
│   └── api-contract.md                     THE contract — read before any endpoint
│
├── app/                                    Expo React Native client
├── server/                                 Express + MongoDB API
│
├── .gitattributes
├── .gitignore
├── .prettierignore
├── .prettierrc.json                        single shared config, both halves
├── package.json                            root only — husky + lint-staged
└── README.md                               this file
```

Rubric deliverables (SRS, diagrams, test plan, report) are **not** in this repo by decision — Lahiru manages those separately.

---

## `server/` — Express + MongoDB API

```
server/
├── src/
│   ├── config/
│   │   ├── Config.js                       ONLY file that reads process.env (exports `env`)
│   │   └── Database.js                     Mongoose connect + graceful shutdown
│   │
│   ├── models/                             thin: schema only, each class extends mongoose.Model
│   │   ├── User.js                         email, passwordHash, role enum, isActive
│   │   ├── ExpiringToken.js                abstract base: user ref + expiresAt TTL fields
│   │   ├── RefreshToken.js                 token, user ref, expiresAt + TTL index
│   │   └── PasswordResetToken.js           single-use reset token, expiresAt + TTL index
│   │
│   ├── routes/                             one BaseRoutes subclass per group, mounted by App
│   │   ├── BaseRoutes.js                   abstract: mount path + Router, registerRoutes()
│   │   ├── HealthRoutes.js
│   │   ├── AuthRoutes.js
│   │   └── UploadRoutes.js
│   │
│   ├── controllers/                        one per route group
│   │   ├── BaseController.js               binds handlers, forwards async errors
│   │   ├── HealthController.js
│   │   ├── AuthController.js               thin — no business logic
│   │   └── UploadController.js
│   │
│   ├── services/                           business logic lives here, reusable + testable
│   │   ├── AuthService.js                  hashing, credentials, change/reset password, deactivation
│   │   ├── TokenService.js                 sign, verify, persist, revoke
│   │   ├── EmailService.js                 sends through the configured transport
│   │   ├── StorageService.js               Supabase Storage uploads
│   │   └── email/
│   │       ├── EmailTransport.js           abstract transport
│   │       ├── NoopEmailTransport.js       default — records messages, sends nothing
│   │       ├── BrevoEmailTransport.js      Brevo API (EMAIL_TRANSPORT=brevo)
│   │       ├── EmailTemplate.js            abstract: render() → subject/html/text
│   │       └── PasswordResetEmail.js
│   │
│   ├── validators/                         one per route group, Joi schemas as static members
│   │   ├── AuthValidator.js
│   │   └── UploadValidator.js
│   │
│   ├── middleware/
│   │   ├── AuthMiddleware.js               requireAuth, optionalAuth, requireRole
│   │   ├── ErrorHandler.js                 JSON 404 + central error handler, registered LAST
│   │   ├── RequestValidator.js             runs a Joi schema, returns 400
│   │   └── FileUploadMiddleware.js         multer, type/extension/size checks
│   │
│   ├── utils/
│   │   ├── AsyncHandler.js                 wraps async handlers → error middleware
│   │   ├── ApiError.js                     thrown by services, caught centrally
│   │   └── ApiResponse.js                  success/error envelope helpers
│   │
│   ├── core/
│   │   ├── App.js                          Express assembly — exports `app`, no listen()
│   │   └── Server.js                       shutdown hooks, connects DB, binds port
│   │
│   └── server.js                           entry point: starts a Server
│
├── scripts/
│   ├── seed.js                             entry point: runs DatabaseSeeder
│   └── DatabaseSeeder.js                   idempotent, one user per role
│
├── tests/
│   ├── setup.js                            in-memory Mongo, reset between tests
│   ├── integration/
│   │   ├── auth.register.test.js
│   │   ├── auth.login.test.js
│   │   ├── auth.tokens.test.js
│   │   ├── auth.change-password.test.js
│   │   ├── auth.password-reset.test.js
│   │   ├── auth.deactivate.test.js
│   │   ├── auth.deactivated-account.test.js
│   │   ├── auth.optional.test.js
│   │   ├── auth.rbac.test.js
│   │   └── upload.create.test.js
│   └── unit/
│       └── email.service.test.js
│
├── .env.example                            every var, dummy values, committed
├── .lintstagedrc.json
├── eslint.config.js                        Node target
├── jest.config.js
├── package.json
└── README.md                               setup, seed creds, schema + RBAC conventions
```

### Server layering rules

Requests flow **route → validate → middleware → controller → service → model**. Never skip inward.

| Layer | Does | Never does |
|---|---|---|
| `routes/` | Declares paths, attaches middleware and one controller method | Contains logic |
| `middleware/` | Auth, role checks, validation, error handling | Talks to models directly (except `requireAuth` loading the user) |
| `controllers/` | Reads `req`, calls a service, sends the response | Contains business logic, queries models, uses try/catch |
| `services/` | Business logic, model queries, token work | Touches `req` or `res` |
| `models/` | Schema, indexes, `toJSON` transforms | Contains business logic or request-shaped logic |

**Controllers must not contain `try/catch`.** Every controller extends `BaseController`, which wraps its handlers so anything thrown reaches `ErrorHandler`; services throw `ApiError`.

**Every response goes through the envelope helpers in `utils/ApiResponse.js`.** The React Native client is built against that shape; a hand-rolled response breaks it silently.

### Server class conventions

- **One class per file, named after the class** (`AuthService.js` holds `AuthService`). The only non-class files are the entry scripts `src/server.js` and `scripts/seed.js`, which keep their paths so `npm start` and `npm run seed` never change.
- **Classes with dependencies or state export the class and one shared instance**, named in camelCase (`AuthService` → `authService`). Dependencies are constructor parameters that default to those shared instances, so a test can pass its own.
- **Stateless helpers use static members**: `ApiResponse`, `AsyncHandler`, `RequestValidator`, `ErrorHandler` and the validators.
- **Every public controller method is a route handler.** `BaseController` binds and wraps all of them, so a helper a controller needs internally must be a `#private` method.
- **Base classes:** `BaseController`, `BaseRoutes`, `ExpiringToken` (models), `EmailTransport` and `EmailTemplate`.

---

## `app/` — Expo React Native client

```
app/
├── src/
│   ├── api/
│   │   ├── client.js                       Axios + interceptors + refresh queue
│   │   ├── index.js                        resolves mock vs real from USE_MOCK flag
│   │   ├── authApi.js                      real implementation
│   │   ├── uploadApi.js                    real implementation (no mock)
│   │   └── mock/
│   │       └── authApi.js                  same signatures, fake data, FAKES FAILURES TOO
│   │
│   ├── components/
│   │   └── ui/                             shared kit, used by every screen
│   │       ├── AuthShell.js                ink header + sheet layout for auth screens
│   │       ├── Avatar.js
│   │       ├── Badge.js
│   │       ├── Brand.js                    brand mark + APP_NAME wordmark
│   │       ├── Button.js
│   │       ├── Card.js
│   │       ├── Chip.js
│   │       ├── ConfirmDialog.js
│   │       ├── DateField.js
│   │       ├── Dropdown.js
│   │       ├── EmptyState.js
│   │       ├── HeroHeader.js               HeroHeader, HeroStickyBar, HeroSheet
│   │       ├── Loader.js
│   │       ├── Notice.js
│   │       ├── PasswordStrengthMeter.js
│   │       ├── ProgressPips.js
│   │       ├── RoleStrip.js
│   │       ├── Screen.js                   safe area + padding wrapper
│   │       ├── ScreenHeader.js
│   │       ├── SectionLabel.js
│   │       ├── SegmentedControl.js
│   │       └── TextInput.js
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── RoleSelectScreen.js
│   │   │   ├── SignUpScreen.js
│   │   │   ├── LoginScreen.js
│   │   │   ├── ForgotPasswordScreen.js
│   │   │   └── ResetPasswordScreen.js
│   │   ├── shared/                         every signed-in role
│   │   │   ├── HomeScreen.js               placeholder landing screen
│   │   │   ├── AccountSettingsScreen.js
│   │   │   └── ChangePasswordScreen.js
│   │   └── dev/
│   │       └── ComponentDemoScreen.js      dev only, excluded from prod nav
│   │
│   ├── navigation/
│   │   ├── RootNavigator.js                conditional render, NOT navigation
│   │   ├── AuthStack.js
│   │   ├── MainTabs.js                     bottom tabs, one navigator for every role
│   │   ├── tabBarTheme.js                  shared tab bar colours
│   │   └── navigationRef.js
│   │
│   ├── store/
│   │   ├── AuthContext.js                  single source of truth for session
│   │   └── secureStorage.js                expo-secure-store wrapper
│   │
│   ├── hooks/
│   │   ├── useAuth.js                      consumes AuthContext
│   │   └── useHeroScroll.js                scroll state for HeroHeader screens
│   │
│   ├── constants/
│   │   └── config.js                       APP_NAME; ONLY file reading EXPO_PUBLIC_* vars
│   │
│   └── utils/
│       ├── validation.js                   client-side form rules
│       └── format.js                       dates, relative time, file sizes
│
├── assets/                                 icons and splash images
├── App.js                                  fonts, providers + RootNavigator, nothing else
├── index.js
├── global.css                              Tailwind directives
├── tailwind.config.js                      content globs + design tokens
├── babel.config.js                         NativeWind preset
├── metro.config.js                         NativeWind wrapper
├── app.json                                Expo config
├── .env.example
├── .lintstagedrc.json
├── eslint.config.js                        React + hooks, rules-of-hooks as error
├── package.json
└── README.md                               beginner-level setup guide
```

### Client layering rules

| Layer | Does | Never does |
|---|---|---|
| `screens/` | Composes components, calls hooks and api functions, handles UI state | Talks to Axios directly, reads tokens, uses `StyleSheet` |
| `components/ui/` | Presentational only — props in, JSX out | API calls, navigation, business logic |
| `components/<feature>/` | Feature-specific presentation | API calls |
| `navigation/` | Route structure, reads auth status from context | Reads tokens from secure storage |
| `store/` | Session state and secure token access | Renders UI |
| `api/` | HTTP calls, token attachment, refresh | Renders UI or navigates |

**No screen ever sees a token.** `client.js` attaches it, refreshes it, and retries. If a screen needs to know about tokens, the interceptor is wrong.

**All styling is NativeWind `className`.** No `StyleSheet.create` anywhere. Colours come from token names (`bg-primary`), never raw hex.

**Only `components/ui/` is shared.** Feature-specific components go in `components/<feature>/`. If you need something added to the shared kit, ask rather than fork.

---

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Server classes | PascalCase, one class per file, `<Resource><Layer>.js` | `AuthController.js`, `TokenService.js` |
| Models | PascalCase, singular | `User.js` |
| React components | PascalCase, one per file | `Button.js`, `ScreenHeader.js` |
| Screens | PascalCase + `Screen` suffix | `LoginScreen.js` |
| Navigators | PascalCase + `Navigator` / `Stack` / `Tabs` | `RootNavigator.js`, `MainTabs.js` |
| Hooks | camelCase, `use` prefix | `useAuth.js` |
| API modules | camelCase + `Api` suffix | `uploadApi.js` |
| Test files | `tests/integration/` or `tests/unit/`, `<resource>.<behaviour>.test.js` | `tests/integration/auth.login.test.js` |
| Branches | `feature/<short-description>` | `feature/jwt-login` |
| Commits | include the Jira key | `<KEY>-57 add login endpoint` |

Routes are plural, lowercase, hyphenated: `/api/uploads`, `/api/item-categories`.

---

## Linting, formatting, and the pre-commit hook

Both `app/` and `server/` share one Prettier config (`.prettierrc.json` at the repo root) and each has its own ESLint config (`app/eslint.config.js`, `server/eslint.config.js`). `eslint-config-prettier` is applied in both so ESLint never fights Prettier over formatting — ESLint owns code-quality rules, Prettier owns style.

**Run locally**, from inside `app/` or `server/`:

```bash
npm run lint      # ESLint — code-quality rules, fails on errors
npm run format     # Prettier --write — reformats files in place
```

`npm run lint` is also what CI runs on every pull request targeting `develop` or `main` (`.github/workflows/ci.yml`), for both `app/` and `server/`. **The check is required on `develop`** — a PR cannot be merged while it's red.

**Pre-commit hook (Husky + lint-staged).** On every `git commit`, `.husky/pre-commit` runs `npx lint-staged`, which reads `app/.lintstagedrc.json` / `server/.lintstagedrc.json` and runs `eslint --fix` then `prettier --write` against **staged files only** — not the whole project, so it stays fast.

- Pure formatting issues (spacing, quotes, semicolons) are auto-fixed and silently re-staged — you won't see a rejection for those.
- Real lint errors (e.g. `no-unused-vars`, a broken React Hooks rule) can't be auto-fixed. The commit is **aborted** and lint-staged prints the offending file(s) and rule(s).

**When a commit is rejected:**

1. Read the error output — it names the file, line, and rule.
2. Fix the issue (or run `npm run lint -- --fix` / `npm run format` in the relevant directory for anything auto-fixable).
3. `git add` the fixed file(s) and commit again.

Don't reach for `git commit --no-verify` to skip this — it only defers the same failure to CI, where it blocks the PR instead.

---

## Rules for an agent implementing a sub-task

1. **Read `docs/api-contract.md` first** if the task touches an endpoint or an API call. The response envelope is fixed and both sides depend on it.
2. **Put files exactly where this document says.** If the task seems to need a location not listed here, that is a signal to ask, not to invent.
3. **Respect the ticket's `Out of scope` section.** Duplicate implementations in a four-person monorepo are expensive to unpick.
4. **JavaScript only. No TypeScript.**
5. **Never commit secrets.** `.env` is gitignored; `.env.example` gets the dummy values.
6. Install React Native packages with `npx expo install`, not `npm install`, so versions match the SDK.
