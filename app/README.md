# Disaster Management System — Mobile App (Expo)

This is the React Native (Expo) front-end. It's a managed-workflow Expo app written in JavaScript, styled with NativeWind (Tailwind for React Native).

This guide assumes you've never run a React Native project before.

## Prerequisites

- **Node.js** (LTS version) and **npm** — install from [nodejs.org](https://nodejs.org). Check you have them with:
  ```
  node -v
  npm -v
  ```
- **A phone with the Expo Go app installed** — search "Expo Go" on the Play Store (Android) or App Store (iOS).
- **Your phone and computer on the same Wi-Fi network** (needed to connect Expo Go to your computer's dev server; see the tunnel fallback below if this isn't possible).
- **Expo Go's supported SDK version must match this project's Expo SDK (57).** Expo Go on the app store always tracks the latest SDK — if it's ever ahead of what this project uses, update your local Expo Go, or ask the team whether the project's SDK needs bumping to match.

You do **not** need Android Studio or Xcode installed — Expo Go lets you run the app on a real device without a native build.

## Install

1. Clone the repo and open a terminal in the `app/` folder:
   ```
   cd app
   ```
2. Install dependencies:
   ```
   npm install
   ```

## Environment configuration

1. Copy the example env file:
   ```
   cp .env.example .env
   ```
   (On Windows PowerShell: `copy .env.example .env`)
2. Fill in the values in `.env` as needed. Currently:
   - `EXPO_PUBLIC_API_BASE_URL` — the base URL of the backend API.
   - `EXPO_PUBLIC_USE_MOCK` — set to `false` to call the real API instead of the mock adapter. Defaults to mock (any value other than `false`, including leaving it unset).

   Variables must be prefixed with `EXPO_PUBLIC_` to be readable in app code (this is an Expo requirement — anything without that prefix is not exposed to the JS bundle). They're read through `src/constants/config.js`, so import from there rather than reading `process.env` directly elsewhere.

## Start the app

```
npx expo start
```

This starts the Metro bundler and prints a QR code in the terminal.

## Open it on your phone with Expo Go

1. Make sure your phone is on the same Wi-Fi network as your computer.
2. Open the **Expo Go** app.
3. Scan the QR code from the terminal (Android: use the scanner inside Expo Go; iOS: scan with the Camera app, then tap the notification to open in Expo Go).
4. The app should build and load on your phone.

**If your phone can't reach your computer** (different networks, restrictive Wi-Fi, VPN, etc.), press `s` in the terminal, or start with tunnel mode directly:

```
npx expo start --tunnel
```

This routes the connection through Expo's servers instead of your local network — slower, but works from anywhere with internet.

## Clearing the Metro cache

If you pull changes that touch `tailwind.config.js`, `babel.config.js`, or `metro.config.js`, or if `className` styles stop applying for no obvious reason, restart with a cleared cache:

```
npx expo start --clear
```

A stale Metro cache is the most common cause of "NativeWind isn't working" — a `className` that silently renders unstyled usually means the cache needs clearing, not that the config is wrong.

## Troubleshooting

- **"Port 8081 is being used by another process"** — another Metro instance is already running (yours or a teammate's). Answer `Y` to use the next port Expo suggests, or stop the other process first.
- **"This project is not supported"/SDK mismatch in Expo Go** — your Expo Go app's supported SDK version doesn't match this project's (currently SDK 57). Update Expo Go from the app store, or ask the team if the project SDK needs to change.
- **Styles not applying** — see "Clearing the Metro cache" above.
