# Disaster Management System — Officer Web Portal (Vite + React)

The **DMC Command Console**: the browser app for the three officer roles (`dmc_officer`, `duty_officer`, `district_officer`). Field roles use the mobile app in `app/`; both talk to the same server in `server/`.

It's a React single-page app built with Vite, written in JavaScript (no TypeScript) and styled with Tailwind. Its folders mirror `app/src`, so if you know the app you already know where things go. See [Folder structure](#folder-structure) below.

## Prerequisites

- **Node.js 22.17 or later** (CI uses 22.17.0) and **npm**. Check with `node -v` and `npm -v`.

## Install

```
cd web
npm install
```

Every dependency is pinned to an exact version, and `web/.npmrc` (`save-exact=true`) makes `npm install <package>` pin new ones too. Don't add `^` ranges by hand.

## Environment configuration

1. Copy the example env file:
   ```
   cp .env.example .env
   ```
   (On Windows PowerShell: `copy .env.example .env`)
2. The variables:

   | Variable            | What it does                                                                                                               |
   | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
   | `VITE_API_BASE_URL` | Base URL of the server, without `/api`. `http://localhost:3000` when the server runs locally (`npm run dev` in `server/`). |
   | `VITE_USE_MOCK`     | Set to `false` to call the real server. Any other value, or leaving it unset, uses the mock API: no server needed.         |

   Only variables prefixed with `VITE_` reach the browser (a Vite rule). They're read in `src/constants/config.js` and nowhere else, so import from there instead of reading `import.meta.env` directly.

   Anything in `.env` ends up in the JavaScript bundle that browsers download, so never put a secret in it.

## Run it

```
npm run dev
```

Open the URL it prints (normally <http://localhost:5173>). In mock mode, sign in by clicking one of the three demo accounts on the login page. Against the real server, run `npm run seed` in `server/` once first, so the same accounts exist there (password `Password123!`).

## Scripts

| Command           | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                                        |
| `npm run build`   | Production build into `dist/`                                     |
| `npm run preview` | Serves the production build locally, to check it before deploying |
| `npm run lint`    | ESLint. CI runs this and `npm run build` on every pull request    |
| `npm run format`  | Prettier `--write`, using the repo's shared `.prettierrc.json`    |

There's no test runner in `web/` yet.

## Folder structure

```
web/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/
│   │   ├── client.js               Axios + interceptors + refresh queue (same as the app's)
│   │   ├── index.js                resolves mock vs real from USE_MOCK
│   │   ├── authApi.js              real implementation: login, refresh, logout, getCurrentUser
│   │   └── mock/
│   │       └── authApi.js          same signatures, fake data, FAKES FAILURES TOO
│   ├── components/
│   │   └── ui/                     shared kit: presentational only, props in, JSX out
│   │       ├── AuthShell.jsx       navy panel + form layout for the login page
│   │       ├── Brand.jsx           brand mark + APP_NAME wordmark
│   │       ├── Button.jsx
│   │       ├── Card.jsx
│   │       ├── Loader.jsx
│   │       ├── Notice.jsx
│   │       ├── Screen.jsx          padding wrapper for a console page
│   │       ├── ScreenHeader.jsx    page title
│   │       ├── SectionLabel.jsx
│   │       └── TextInput.jsx
│   ├── constants/
│   │   ├── config.js               APP_NAME; ONLY file reading import.meta.env
│   │   ├── roles.js                role values, labels, mobile/web platform per role
│   │   └── demoUsers.js            demo accounts: login picker + mock API users
│   ├── hooks/
│   │   └── useAuth.js              consumes AuthContext
│   ├── navigation/
│   │   ├── RootNavigator.jsx       conditional render, NOT navigation; gates non-officer roles
│   │   ├── AuthRoutes.jsx          signed-out routes: /login
│   │   ├── ConsoleRoutes.jsx       signed-in routes: every console page
│   │   ├── ConsoleLayout.jsx       top bar + sidebar + current page
│   │   └── sidebarItems.js         sidebar links: path, label, icon
│   ├── screens/
│   │   ├── auth/
│   │   │   └── LoginScreen.jsx
│   │   └── shared/
│   │       ├── PlaceholderScreen.jsx     stands in for every console page until it's built
│   │       └── WrongPlatformScreen.jsx   field / unknown roles stop here, with Log out
│   ├── store/
│   │   ├── AuthContext.jsx         single source of truth for the session
│   │   └── tokenStorage.js         localStorage wrapper (see "Token storage" below)
│   └── utils/                      empty for now
├── App.jsx                         providers + router + RootNavigator, nothing else
├── index.jsx                       entry point: mounts App, imports global.css
├── index.html                      the page Vite serves; loads index.jsx
├── global.css                      Tailwind import + design tokens (@theme)
├── vite.config.js
├── eslint.config.js                same rules as app/eslint.config.js
├── .env.example
├── .lintstagedrc.json
├── .npmrc                          save-exact=true
├── package.json
└── README.md
```

### How it maps onto `app/`

Same folder names, same file names and the same layering rules as `app/` (see the root README's "Client layering rules"). Where the web works differently, the file keeps its role:

| `web/`                                 | `app/` equivalent                                | Why it differs                                                                                                                 |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `*.jsx` for files containing JSX       | `*.js`                                           | Vite only parses JSX in `.jsx` files. Names are otherwise identical (`LoginScreen.jsx`).                                       |
| `navigation/` with React Router        | `navigation/` with React Navigation              | Same folder, same job.                                                                                                         |
| `navigation/AuthRoutes.jsx`            | `navigation/AuthStack.js`                        | A set of `<Route>`s instead of a stack navigator.                                                                              |
| `navigation/ConsoleRoutes.jsx`         | `AppStack` in `RootNavigator.js` + `MainTabs.js` | The signed-in routes.                                                                                                          |
| `navigation/ConsoleLayout.jsx`         | `MainTabs.js`'s tab bar                          | A sidebar instead of bottom tabs.                                                                                              |
| `navigation/sidebarItems.js`           | `ICONS` in `MainTabs.js`, `tabBarTheme.js`       | Icons come from `lucide-react` (the web's `@expo/vector-icons`); colours come from Tailwind tokens, so no separate theme file. |
| —                                      | `navigation/navigationRef.js`                    | Not needed: nothing navigates from outside a component.                                                                        |
| `store/tokenStorage.js`                | `store/secureStorage.js`                         | Same interface, but it's localStorage, which isn't secure storage, so the name says so.                                        |
| `global.css` (`@theme` block)          | `tailwind.config.js` + `global.css`              | Tailwind 4 defines tokens in CSS. The app is on Tailwind 3 because NativeWind needs it.                                        |
| `vite.config.js`                       | `babel.config.js` + `metro.config.js`            | The bundler config.                                                                                                            |
| `index.jsx` + `index.html`             | `index.js` + `app.json`                          | The entry point, and the page title/favicon.                                                                                   |
| `screens/shared/PlaceholderScreen.jsx` | `screens/shared/HomeScreen.js`                   | The placeholder landing page, reused for every sidebar page until each is built.                                               |

### Files copied from `app/` — keep them in sync

`app/` and `web/` share no code (no workspace, no shared package). These files are copies, so **when you change one, change its twin in the same pull request**:

| `web/`                       | Copy of                          | Differences                                                                                 |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/constants/roles.js`     | `app/src/constants/roles.js`     | Adds `isWebRole()`.                                                                         |
| `src/constants/demoUsers.js` | `app/src/constants/demoUsers.js` | None. Both must also match `server/scripts/DatabaseSeeder.js`.                              |
| `src/api/client.js`          | `app/src/api/client.js`          | Uses `tokenStorage` instead of `secureStorage`.                                             |
| `src/api/authApi.js`         | `app/src/api/authApi.js`         | Only login, refresh, logout, getCurrentUser. Copy the others over when a screen needs them. |
| `src/api/mock/authApi.js`    | `app/src/api/mock/authApi.js`    | Same subset.                                                                                |
| `src/store/AuthContext.jsx`  | `app/src/store/AuthContext.js`   | Same subset, plus logout sync across browser tabs.                                          |

## Routing and the role gate

`navigation/RootNavigator.jsx` works like the app's: it doesn't navigate, it chooses which set of routes to render.

- **Loading** (checking a stored session against `/api/auth/me`): a full-screen spinner. Nothing redirects until this answers.
- **Signed out:** `AuthRoutes`. `/login` shows the login page; any other URL redirects to `/login` and remembers the URL, so signing in takes you back to it.
- **Signed in as an officer:** `ConsoleRoutes`, every page inside `ConsoleLayout`. `/login` sends you on to the remembered URL (or the Dashboard), and unknown URLs go to the Dashboard.
- **Signed in as a field role, or a role the portal doesn't know:** `WrongPlatformScreen`, with Log out.

To build a console page, create its screen (e.g. `screens/hazardWarnings/HazardWarningsScreen.jsx`) and swap it in for that route's `PlaceholderScreen` in `ConsoleRoutes.jsx`. To add a page, add a route there and a link in `sidebarItems.js`; the two paths must match.

## Styling

Tailwind classes only. All colours are defined in one place: the `@theme` block in `global.css`. Tailwind's built-in palette is switched off, so only these names exist (`bg-navy`, `text-danger-ink`, `border-line`, ...). Never use raw hex in a component. The token names match `app/tailwind.config.js`, with `navy` in place of the app's orange `signal`. The navy, red and green values are provisional until they're matched to the wireframes.

## Token storage

Tokens live in `localStorage` (`store/tokenStorage.js`). Any script running on the page can read `localStorage`, so an XSS bug would let an attacker steal the refresh token. That's accepted for now. The fix is for the server to set the refresh token as an httpOnly cookie, which needs server changes.

All tabs share the same tokens, so logging out in one tab logs out the others.

## Deploying

The production build (`dist/`) is static files. Because the app routes in the browser, the host must serve `index.html` for every path (a "rewrite all routes to /index.html" rule, e.g. a Render static site rewrite of `/*` to `/index.html`). Otherwise reloading `/hazard-warnings` returns a 404. Set `VITE_API_BASE_URL` and `VITE_USE_MOCK=false` in the host's build environment: Vite writes them into the build, so they can't be changed after it.

## Troubleshooting

- **Reloading the page in mock mode signs you out.** Expected: the mock API keeps its sessions in memory, and a reload starts a fresh one (the app's mock does the same). Log in again from the demo picker; it takes you back to the page you were on.
- **`Error: listen EACCES: permission denied ::1:5173`** on Windows: Windows has reserved a port range that includes 5173 (Hyper-V, WSL and Docker do this). Check with `netsh interface ipv4 show excludedportrange protocol=tcp`, then use a port outside those ranges, e.g. `npm run dev -- --port 5300`. The server accepts requests from any origin, so a different port needs no server change.
- **Network errors against the real server:** check `VITE_API_BASE_URL` (no trailing `/api`) and that the server is running. After editing `.env`, restart `npm run dev`: Vite reads it only at startup.
