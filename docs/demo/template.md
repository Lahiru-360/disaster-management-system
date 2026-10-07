# Demo script template (DMS-117)

Copy this file to `docs/demo/UC0X.md` for your use case. `UC02.md` is a filled-in example.

One script per use case. Each flow, main, alternate and exception alike, gets the same seven fields, so anyone can run it on the day. Keep it to what is clicked and what must be seen.

## UC0X <name>, owner <name>

**Before the demo (once):**
- Server: `cd server && npm run seed -- --reset-demo` (resets demo data; accounts and geography are kept), then `npm run dev`.
- Web: `cd web && VITE_USE_MOCK=false npm run dev`. App: `cd app && EXPO_PUBLIC_USE_MOCK=false npx expo start`.
- Demo flags in `server/.env` (they only switch the existing mocks, never business logic): <flag=value, or "none">.
- Devices: <browser / phone / two browsers …>.

### <Flow id: title> (e.g. Main 1–9: submit a report)
| Field | Value |
|---|---|
| Accounts | <email (role)> (password `Password123!`) |
| Starting data | <what must exist first, and which seeder creates it> |
| Click path | 1. … 2. … 3. … |
| Expected result | <what is on screen, with exact wording> |
| How to trigger | <only for alternates/exceptions: the action or demo flag that causes it> |
| Fallback if it fails live | <what to show instead: screenshot, test run, Postman call> |
| Time | <≈ seconds> |

(Repeat for each flow.)

**Reset between runs:** <what to undo, e.g. `npm run seed -- --only=uc0X --reset-demo`>.
**Evidence for the report:** <screenshots / coverage output to capture>.
