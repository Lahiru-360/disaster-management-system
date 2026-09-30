# Execution Order — Assignment 02 Implementation

The most optimistic order for every story, task and sub-task, arranged so that all four members work in parallel with as little blocking as possible.
Full descriptions, acceptance criteria and links are in [Project_Management_Plan.md](Project_Management_Plan.md).

## How to use this file

- Work **top to bottom within your own column** for each day. Days are the target dates from the plan's sprints; if the team is behind, keep the **order** and let the dates slide.
- **Merge** rows mean: open the PR, get it approved, merge to `develop`. Other members may be waiting on it.
- **Needs** lists what must already be merged (or at least available on a branch) before you start that row. Anything not listed can start immediately.
- ⭐ marks a merge that unblocks **another member**. Do these first, and say at stand-up when they land.
- Server first, screen second: each story's server part is merged before its screen, and screens start against the mock API, so UI work never waits on the backend.

## Ordering rules used

1. **Shared blockers first**, starting with DMS-104 (the head of the critical path) on Day 1.
2. **Contracts and schemas before code**: every `.1` contract draft and every model UC04 reads (HazardAlert, Notification, OccupancyRecord, SupplyDistribution) exists before the Wed 30 Sep freeze.
3. **Cross-member hand-offs are scheduled at least a day before they are needed** (X-1: UC02 confirm on Day 5, used by UC01 A1 on Day 6–7).
4. **Related server logic is built together**, to avoid rework and merge conflicts in the same file. For example, UC02 validation, clustering and idempotency go with the submit service; UC03 E1/E5 validation goes with occupancy and supply.
5. **One owner per shared file per day**: `App.js`, `ConsoleRoutes.jsx`, `MainTabs.js` and the seeders get one-line additions only, and you rebase on `develop` every morning.
6. **Tests are written with each story** (the `Server tests` sub-tasks). The `DMS-129 / 139 / 152 / 163` stories on Day 10–11 only close coverage gaps and collect evidence.

## Legend

| Type | Meaning |
|---|---|
| Sub-task | A step inside a story (`DMS-120.3`) |
| Merge (Story / Task / Test) | The whole ticket is Done and merged |
| Check | A team action without its own ticket |

## Member overview

| Member | Owns | Shared work |
|---|---|---|
| Anupa | UC01 (DMS-120 – DMS-129) | DMS-101, 104, 106, 114 |
| Bineth | UC02 (DMS-130 – DMS-139) | DMS-103, 105, 109, 111, 117 |
| Lahiru | UC03 (DMS-140 – DMS-152) | DMS-102, 112, 113, 119 |
| Sayuni | UC04 (DMS-153 – DMS-163) | DMS-107, 108, 110, 115, 116, 118 |

## Day 0 — Sun 27 Sep (S0)

**Goal:** Kick-off: board, prompt log, UC03 design decisions

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 1 | Anupa | DMS-101.1 | Create the Jira project and import tickets | Sub-task | — |
| 2 | Anupa | DMS-101.2 | Configure the sprints | Sub-task | — |
| 3 | Anupa | DMS-101.3 | Branch protection | Sub-task | — |
| 4 | Anupa | DMS-101.4 | PR template | Sub-task | — |
| 5 | Anupa | **DMS-101** | **Merge:** Jira board, branch protection and PR workflow setup | Task | — |
| — | Bineth | — | Free: help review others' PRs | Check | — |
| 6 | Lahiru | DMS-149.1 | Design decision note | Sub-task | — |
| 7 | Sayuni | DMS-118.2 | Shared prompt log | Sub-task | — |

## Day 1 — Mon 28 Sep (S1)

**Goal:** Start everything that has no dependency; ship the geography model (critical path)

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 8 | Anupa | DMS-104.1 | Contract section "Areas" | Sub-task | — |
| 9 | Anupa | DMS-104.2 | Models | Sub-task | — |
| 10 | Anupa | DMS-104.3 | Domain classes | Sub-task | — |
| 11 | Anupa | DMS-104.4 | AreaRegistry + GeoDistance | Sub-task | — |
| 12 | Anupa | DMS-104.5 | Controller, routes, mounting | Sub-task | — |
| 13 | Anupa | DMS-104.6 | Seed data | Sub-task | — |
| 14 | Anupa | DMS-104.7 | Tests | Sub-task | — |
| 15 | Anupa | **DMS-104** ⭐ | **Merge:** Shared geography model: District, RiverBasin, TargetArea + AreaRegistry + GeoDistance | Story | — |
| 16 | Anupa | DMS-120.2 | Enums | Sub-task | — |
| 17 | Anupa | DMS-106.1 | Contract section "Notifications" | Sub-task | — |
| 18 | Anupa | DMS-106.2 | Model + channel base | Sub-task | — |
| 19 | Bineth | DMS-109.1 | Validator list | Sub-task | — |
| 20 | Bineth | DMS-109.2 | Contract edit | Sub-task | — |
| 21 | Bineth | DMS-109.3 | Integration test | Sub-task | — |
| 22 | Bineth | **DMS-109** | **Merge:** Add `hazard-reports` upload folder + contract §6 update | Task | — |
| 23 | Bineth | DMS-111.1 | Role→tabs map | Sub-task | — |
| 24 | Bineth | DMS-111.2 | MainTabs refactor + icons | Sub-task | — |
| 25 | Bineth | DMS-111.3 | Placeholder screens + API wiring | Sub-task | — |
| 26 | Bineth | **DMS-111** ⭐ | **Merge:** Mobile navigation for field features (role-based tabs + inbox) | Story | — |
| 27 | Bineth | DMS-130.1 | Contract §9 Hazard reports (draft) | Sub-task | — |
| 28 | Bineth | DMS-130.2 | Enums | Sub-task | — |
| 29 | Lahiru | DMS-102.1 | Jest coverage settings | Sub-task | — |
| 30 | Lahiru | DMS-102.2 | Per-UC scopes | Sub-task | — |
| 31 | Lahiru | DMS-102.3 | Thresholds | Sub-task | — |
| 32 | Lahiru | DMS-140.1 | Contract §10 Coordination (draft) | Sub-task | — |
| 33 | Lahiru | DMS-140.2 | Enums | Sub-task | — |
| 34 | Sayuni | DMS-108.1 | Modal + ConfirmDialog | Sub-task | — |
| 35 | Sayuni | DMS-108.2 | DataTable, StatusBadge, ProgressBar, EmptyState | Sub-task | — |
| 36 | Sayuni | DMS-108.3 | Tabs, ChipGroup, Select, TextArea with counter | Sub-task | — |
| 37 | Sayuni | DMS-110.1 | Seeder base + runner | Sub-task | — |
| 38 | Sayuni | DMS-110.2 | Move user seeding | Sub-task | — |
| 39 | Sayuni | DMS-110.3 | UC hook files | Sub-task | — |
| 40 | Sayuni | DMS-107.1 | Contract sections | Sub-task | — |

## Day 2 — Tue 29 Sep (S1)

**Goal:** Finish every shared blocker; lock the data schemas UC04 depends on

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 41 | Anupa | DMS-106.3 | NotificationService | Sub-task | — |
| 42 | Anupa | DMS-106.4 | Controller + routes | Sub-task | — |
| 43 | Anupa | DMS-106.7 | Tests (server) | Sub-task | — |
| 44 | Anupa | — | Merge the DMS-106 server part (NotificationService + endpoints) — unblocks Bineth and Lahiru (X-4) | Check | — |
| 45 | Anupa | DMS-120.1 | Contract §8 Hazard alerts (draft) | Sub-task | — |
| 46 | Anupa | DMS-121.1 | Contract | Sub-task | — |
| 47 | Bineth | DMS-105.1 | User schema | Sub-task | DMS-104 |
| 48 | Bineth | DMS-105.2 | PersonFactory mapping | Sub-task | — |
| 49 | Bineth | DMS-105.3 | Seeder update | Sub-task | — |
| 50 | Bineth | DMS-105.4 | Docs | Sub-task | — |
| 51 | Bineth | **DMS-105** ⭐ | **Merge:** Person profile fields (homeDistrict, district, shiftDistrict, phone) + seeded citizens | Story | — |
| 52 | Bineth | DMS-103.1 | User and token helpers | Sub-task | DMS-105 |
| 53 | Bineth | DMS-103.2 | Area fixtures | Sub-task | DMS-104 |
| 54 | Bineth | DMS-103.3 | FakeClock | Sub-task | — |
| 55 | Bineth | DMS-103.4 | FakeChannel | Sub-task | DMS-106.2 |
| 56 | Bineth | DMS-103.5 | Example usage | Sub-task | — |
| 57 | Bineth | **DMS-103** ⭐ | **Merge:** Shared backend test helpers (auth tokens, user/area factories, fake clock, fake channels) | Task | — |
| 58 | Lahiru | DMS-102.4 | CI step | Sub-task | — |
| 59 | Lahiru | DMS-102.5 | Documentation | Sub-task | — |
| 60 | Lahiru | **DMS-102** ⭐ | **Merge:** Server coverage configuration + per-UC coverage scripts + CI coverage gate | Task | — |
| 61 | Lahiru | DMS-140.3 | Models | Sub-task | — |
| 62 | Lahiru | DMS-140.4 | Domain classes | Sub-task | — |
| 63 | Lahiru | DMS-141.1 | Contract | Sub-task | — |
| 64 | Lahiru | DMS-141.2 | OccupancyRecord model | Sub-task | — |
| 65 | Lahiru | DMS-143.1 | Contract | Sub-task | — |
| 66 | Lahiru | DMS-143.2 | SupplyDistribution model | Sub-task | — |
| 67 | Lahiru | DMS-142.1 | Contract | Sub-task | — |
| 68 | Sayuni | DMS-107.2 | Enums + models + domain | Sub-task | DMS-104, DMS-120.2 |
| 69 | Sayuni | DMS-107.3 | Controllers + routes | Sub-task | — |
| 70 | Sayuni | DMS-107.4 | Seeders | Sub-task | — |
| 71 | Sayuni | DMS-107.5 | Tests | Sub-task | — |
| 72 | Sayuni | **DMS-107** ⭐ | **Merge:** Shared HazardEvent (incident) + Organisation models | Story | — |
| 73 | Sayuni | DMS-108.4 | MapView | Sub-task | — |
| 74 | Sayuni | DMS-108.5 | Tokens + dev catalogue page + README | Sub-task | — |
| 75 | Sayuni | **DMS-108** ⭐ | **Merge:** Web UI kit additions (Modal, ConfirmDialog, DataTable, Tabs, StatusBadge, MapView…) | Story | — |
| 76 | Sayuni | DMS-110.4 | Idempotency test | Sub-task | DMS-104, DMS-105, DMS-107 |
| 77 | Sayuni | **DMS-110** ⭐ | **Merge:** Per-domain seeders (District, People, Organisation, HazardEvent + UC hooks) | Task | — |

## Day 3 — Wed 30 Sep (S1)

**Goal:** Contract freeze at 6 PM; models behind every frozen schema exist

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 78 | Anupa | DMS-120.3 | HazardAlert model | Sub-task | — |
| 79 | Anupa | DMS-121.2 | Enums + Notification model | Sub-task | — |
| 80 | Anupa | DMS-106.5 | Web inbox dropdown | Sub-task | DMS-108.1 |
| 81 | Anupa | DMS-106.6 | App InboxScreen | Sub-task | DMS-111 |
| 82 | Anupa | **DMS-106** ⭐ | **Merge:** Shared NotificationService + NotificationChannel interface + in-app inbox | Story | — |
| 83 | Bineth | DMS-130.3 | HazardReport model | Sub-task | — |
| 84 | Bineth | DMS-130.4 | HazardReport domain class | Sub-task | — |
| 85 | Bineth | DMS-130.5 | ReferenceNumberGenerator | Sub-task | — |
| 86 | Bineth | DMS-131.1 | Contract | Sub-task | — |
| 87 | Bineth | DMS-132.1 | Contract | Sub-task | — |
| 88 | Lahiru | DMS-112.1 | Review checklist | Sub-task | — |
| 89 | Lahiru | DMS-112.2 | Freeze meeting (30 min) | Sub-task | all contract drafts (x.1) |
| 90 | Lahiru | DMS-112.3 | Merge + announce | Sub-task | — |
| 91 | Lahiru | **DMS-112** ⭐ | **Merge:** API contract freeze for UC01–UC04 (review gate, Wed 30 Sep) | Task | — |
| 92 | Lahiru | DMS-140.5 | OperationalPictureService | Sub-task | DMS-104, DMS-105, DMS-107 |
| 93 | Lahiru | DMS-140.6 | Controllers + routes + scoping | Sub-task | DMS-104, DMS-105 |
| 94 | Sayuni | DMS-153.1 | Contract §11 Post-event reports (draft) | Sub-task | UC01 + UC03 schemas (X-2, X-3) |
| 95 | Sayuni | DMS-153.2 | PostEventReport model + DataGap subdocument | Sub-task | — |
| 96 | Sayuni | DMS-153.4 | ReportContext + GapDetector | Sub-task | — |
| 97 | Sayuni | DMS-153.3 | ReportSection strategy | Sub-task | DMS-112 schemas |
| 98 | Sayuni | DMS-118.1 | Front page | Sub-task | — |

## Day 4 — Thu 1 Oct (S2)

**Goal:** First main-flow backends working; UC04 builds on fixtures

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 99 | Anupa | DMS-120.4 | HazardAlert domain class | Sub-task | — |
| 100 | Anupa | DMS-120.5 | CitizenRegistry + MessageTemplate | Sub-task | — |
| 101 | Anupa | DMS-120.6 | WarningService.startDraft / preview / saveDraftMessage | Sub-task | DMS-104, DMS-105, DMS-107 |
| 102 | Anupa | DMS-120.7 | HazardAlertValidator + controller + routes | Sub-task | — |
| 103 | Anupa | DMS-120.8 | Seed data (Uc01Seeder) | Sub-task | — |
| 104 | Anupa | DMS-120.11 | Server tests for this story | Sub-task | — |
| 105 | Bineth | DMS-136.1 | Joi schema + Sri Lanka bounds check | Sub-task | — |
| 106 | Bineth | DMS-136.3 | Server tests | Sub-task | — |
| 107 | Bineth | DMS-135.1 | `findNearbyPending(location, hazardType, since)` | Sub-task | — |
| 108 | Bineth | DMS-135.2 | `ClusterAssigner` | Sub-task | — |
| 109 | Bineth | DMS-130.6 | HazardReportService.submit | Sub-task | DMS-104, DMS-105, DMS-106, DMS-109 |
| 110 | Bineth | DMS-130.7 | Validator, controller, routes | Sub-task | — |
| 111 | Bineth | DMS-130.10 | Seed data (Uc02Seeder) | Sub-task | — |
| 112 | Bineth | DMS-130.11 | Server tests for this story | Sub-task | — |
| 113 | Lahiru | DMS-140.7 | Seed data (Uc03Seeder) | Sub-task | — |
| 114 | Lahiru | DMS-140.10 | Server tests for this story | Sub-task | — |
| 115 | Lahiru | DMS-140.8 | Web API module + mock | Sub-task | — |
| 116 | Lahiru | DMS-141.3 | Domain rules | Sub-task | — |
| 117 | Lahiru | DMS-141.4 | `ShelterService.updateOccupancy` | Sub-task | — |
| 118 | Lahiru | DMS-147.1 | Joi rule | Sub-task | — |
| 119 | Lahiru | DMS-141.7 | Server tests | Sub-task | — |
| 120 | Lahiru | DMS-147.3 | Server tests | Sub-task | — |
| 121 | Sayuni | DMS-153.7 | Fixture dataset (Uc04Seeder) | Sub-task | DMS-112, DMS-110 |
| 122 | Sayuni | DMS-153.5 | ReportBuilder | Sub-task | — |
| 123 | Sayuni | DMS-153.6 | PostEventReportService.generate + validator + controller + routes | Sub-task | — |
| 124 | Sayuni | DMS-159.1 | Validator | Sub-task | — |
| 125 | Sayuni | DMS-160.1 | Builder "all empty" detection | Sub-task | — |
| 126 | Sayuni | DMS-160.2 | Contract code | Sub-task | — |
| 127 | Sayuni | DMS-153.10 | Server tests for this story | Sub-task | — |
| 128 | Sayuni | DMS-159.3 | Server tests | Sub-task | — |
| 129 | Sayuni | DMS-160.4 | Server tests | Sub-task | — |

## Day 5 — Fri 2 Oct (S2)

**Goal:** UC02 confirm live for UC01 A1 (X-1); broadcast, dispatch, supply and export servers

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 130 | Anupa | DMS-120.9 | Web API module + mock | Sub-task | — |
| 131 | Anupa | DMS-121.3 | Channel strategies | Sub-task | DMS-106 |
| 132 | Anupa | DMS-121.4 | BroadcastService | Sub-task | — |
| 133 | Anupa | DMS-121.5 | Summary aggregation | Sub-task | — |
| 134 | Anupa | DMS-121.6 | Controller + routes | Sub-task | — |
| 135 | Anupa | DMS-121.9 | Server tests for this story | Sub-task | — |
| 136 | Anupa | DMS-126.1 | Joi rule + AreaRegistry unknown-id reporting | Sub-task | — |
| 137 | Anupa | DMS-126.3 | Server tests | Sub-task | — |
| 138 | Anupa | DMS-127.1 | Contract code | Sub-task | — |
| 139 | Anupa | DMS-127.2 | Guards in preview and broadcast | Sub-task | — |
| 140 | Anupa | DMS-127.4 | Server tests | Sub-task | — |
| 141 | Bineth | DMS-131.2 | Service methods | Sub-task | DMS-106 |
| 142 | Bineth | DMS-131.3 | Controller + routes with district scoping | Sub-task | — |
| 143 | Bineth | DMS-138.1 | Conditional update in the service | Sub-task | — |
| 144 | Bineth | DMS-138.2 | Contract code | Sub-task | — |
| 145 | Bineth | DMS-131.7 | Server tests for this story | Sub-task | — |
| 146 | Bineth | DMS-138.4 | Server tests | Sub-task | — |
| 147 | Bineth | DMS-132.2 | Domain `dismiss()` + service method | Sub-task | — |
| 148 | Bineth | DMS-132.5 | Server tests | Sub-task | — |
| 149 | Bineth | DMS-130.8 | App API module + mock | Sub-task | — |
| 150 | Lahiru | DMS-142.2 | Dispatch model + domain state machine | Sub-task | — |
| 151 | Lahiru | DMS-142.4 | Config | Sub-task | — |
| 152 | Lahiru | DMS-142.3 | DispatchService | Sub-task | DMS-106, DMS-107 |
| 153 | Lahiru | DMS-142.5 | Controllers + routes | Sub-task | — |
| 154 | Lahiru | DMS-142.8 | Server tests for this story | Sub-task | — |
| 155 | Lahiru | DMS-146.1 | Contract | Sub-task | — |
| 156 | Lahiru | DMS-146.2 | Domain `decline()` + service | Sub-task | — |
| 157 | Lahiru | DMS-146.5 | Server tests | Sub-task | — |
| 158 | Lahiru | DMS-143.3 | Domain `ReliefStock.withdraw` | Sub-task | — |
| 159 | Lahiru | DMS-143.4 | SupplyService | Sub-task | DMS-107 |
| 160 | Lahiru | DMS-151.1 | Validation + atomic-guard failure mapping | Sub-task | — |
| 161 | Lahiru | DMS-143.6 | Server tests | Sub-task | — |
| 162 | Lahiru | DMS-151.3 | Server tests | Sub-task | — |
| 163 | Sayuni | DMS-153.8 | Web API module + mock | Sub-task | — |
| 164 | Sayuni | DMS-154.1 | Contract | Sub-task | — |
| 165 | Sayuni | DMS-154.2 | ReportExport model + `ExportFormat` enum | Sub-task | — |
| 166 | Sayuni | DMS-154.3 | Exporter strategies | Sub-task | — |
| 167 | Sayuni | DMS-154.4 | ExportService | Sub-task | — |
| 168 | Sayuni | DMS-161.1 | Error mapping in ExportService | Sub-task | — |
| 169 | Sayuni | DMS-154.6 | Server tests | Sub-task | — |
| 170 | Sayuni | DMS-161.3 | Server tests | Sub-task | — |

## Day 6 — Sat 3 Oct (S2)

**Goal:** Main-flow screens; server work for the remaining alternates

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 171 | Anupa | DMS-120.10 | IssueWarningScreen + feature components | Sub-task | DMS-108 |
| 172 | Anupa | **DMS-120** ⭐ | **Merge:** Main flow (1–8): compose draft warning and preview its reach | Story | — |
| 173 | Anupa | DMS-126.2 | Web field-error mapping helper | Sub-task | — |
| 174 | Anupa | **DMS-126** ⭐ | **Merge:** E1: Invalid target scope | Story | — |
| 175 | Anupa | DMS-127.3 | Web message + disabled state | Sub-task | — |
| 176 | Anupa | **DMS-127** ⭐ | **Merge:** E2: No recipients in scope | Story | — |
| 177 | Anupa | DMS-121.7 | Web confirmation dialog + delivery summary screen | Sub-task | — |
| 178 | Anupa | DMS-121.8 | App alert card | Sub-task | — |
| 179 | Anupa | **DMS-121** ⭐ | **Merge:** Main flow (9–15): confirm, broadcast on all channels, delivery summary | Story | — |
| 180 | Anupa | DMS-122.1 | Contract | Sub-task | — |
| 181 | Anupa | DMS-122.2 | ReportHazardTypeMapper | Sub-task | — |
| 182 | Anupa | DMS-122.3 | WarningService.prefillFromReport | Sub-task | DMS-131.2 (X-1) |
| 183 | Anupa | DMS-122.5 | Server tests | Sub-task | — |
| 184 | Bineth | DMS-130.9 | App screen + components | Sub-task | DMS-111 |
| 185 | Bineth | DMS-136.2 | App client rules + field highlighting | Sub-task | — |
| 186 | Bineth | **DMS-130** ⭐ | **Merge:** Main flow (1–9): submit a hazard report from the mobile app | Story | — |
| 187 | Bineth | **DMS-136** ⭐ | **Merge:** E1: Invalid report rejected with highlighted fields | Story | — |
| 188 | Bineth | DMS-131.4 | Web API module + mock | Sub-task | — |
| 189 | Bineth | DMS-131.5 | Web screen | Sub-task | DMS-108 |
| 190 | Bineth | DMS-133.4 | Server acceptance of `locationSource` | Sub-task | — |
| 191 | Bineth | DMS-133.3 | Gazetteer + places endpoint | Sub-task | — |
| 192 | Bineth | DMS-133.5 | Server tests | Sub-task | — |
| 193 | Bineth | DMS-134.4 | Server idempotency | Sub-task | — |
| 194 | Bineth | DMS-134.5 | Server tests | Sub-task | — |
| 195 | Bineth | DMS-135.4 | Server tests (boundaries) | Sub-task | — |
| 196 | Lahiru | DMS-140.9 | Dashboard screen + components | Sub-task | DMS-108 |
| 197 | Lahiru | **DMS-140** ⭐ | **Merge:** Main flow (1–2, 14): coordination dashboard + combined operational picture | Story | — |
| 198 | Lahiru | DMS-141.5 | Web `UpdateOccupancyDialog.jsx` | Sub-task | — |
| 199 | Lahiru | DMS-141.6 | Seed occupancy history | Sub-task | — |
| 200 | Lahiru | DMS-147.2 | Web field error | Sub-task | — |
| 201 | Lahiru | **DMS-141** ⭐ | **Merge:** Main flow (3–5): update shelter occupancy + status thresholds | Story | — |
| 202 | Lahiru | **DMS-147** ⭐ | **Merge:** E1: Invalid occupancy value | Story | — |
| 203 | Lahiru | DMS-143.5 | Web `LogReliefSupplyDialog.jsx` | Sub-task | — |
| 204 | Lahiru | DMS-151.2 | Web error display | Sub-task | — |
| 205 | Lahiru | **DMS-143** ⭐ | **Merge:** Main flow (12–13): log relief supply distribution | Story | — |
| 206 | Lahiru | **DMS-151** ⭐ | **Merge:** E5: Insufficient stock | Story | — |
| 207 | Lahiru | DMS-144.1 | Contract | Sub-task | — |
| 208 | Lahiru | DMS-144.2 | Normalised-name unique index + service create | Sub-task | — |
| 209 | Lahiru | DMS-144.4 | Server tests | Sub-task | — |
| 210 | Sayuni | DMS-153.9 | Parameter screen + report view + charts | Sub-task | DMS-108 |
| 211 | Sayuni | DMS-159.2 | Web field errors | Sub-task | — |
| 212 | Sayuni | DMS-160.3 | Web empty state | Sub-task | — |
| 213 | Sayuni | DMS-156.1 | Contract + filter semantics | Sub-task | — |
| 214 | Sayuni | DMS-156.2 | ReportContext filter support in each section | Sub-task | — |
| 215 | Sayuni | DMS-156.4 | Server tests | Sub-task | — |

## Day 7 — Sun 4 Oct (S2)

**Goal:** Cross-member hand-offs on the web; field-app lifecycle; share server

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 216 | Anupa | DMS-122.4 | Web: escalate button + banner | Sub-task | DMS-131.5 (X-1) |
| 217 | Anupa | **DMS-122** ⭐ | **Merge:** A1: Escalate to warning from a CONFIRMED hazard report | Story | — |
| 218 | Anupa | DMS-125.1 | Contract | Sub-task | — |
| 219 | Anupa | DMS-125.2 | Service discard guard | Sub-task | — |
| 220 | Anupa | DMS-125.3 | Web Back, Cancel and Discard handling + the drafts filter | Sub-task | — |
| 221 | Anupa | DMS-125.4 | Server tests | Sub-task | — |
| 222 | Anupa | **DMS-125** ⭐ | **Merge:** A4: Officer backs out of the confirmation / discards draft | Story | — |
| 223 | Anupa | DMS-123.1 | Contract | Sub-task | — |
| 224 | Anupa | DMS-123.2 | WarningService.findActive | Sub-task | — |
| 225 | Anupa | DMS-123.3 | Domain `update()` | Sub-task | — |
| 226 | Bineth | DMS-135.3 | Queue grouping + badge | Sub-task | — |
| 227 | Bineth | DMS-131.6 | App MyReportsScreen | Sub-task | — |
| 228 | Bineth | **DMS-131** ⭐ | **Merge:** Main flow (10–15): pending queue, review and confirm (web) | Story | — |
| 229 | Bineth | **DMS-135** ⭐ | **Merge:** A4: Possible duplicate → link to a cluster | Story | — |
| 230 | Bineth | DMS-132.3 | Web dismiss form | Sub-task | — |
| 231 | Bineth | DMS-132.4 | Reporter message copy | Sub-task | — |
| 232 | Bineth | **DMS-132** ⭐ | **Merge:** A1: Dismiss report with a reason code | Story | — |
| 233 | Bineth | DMS-138.3 | Web handling | Sub-task | — |
| 234 | Bineth | **DMS-138** ⭐ | **Merge:** E3: Report already reviewed by another officer | Story | — |
| 235 | Lahiru | DMS-142.6 | Web `DispatchDialog.jsx` | Sub-task | — |
| 236 | Lahiru | DMS-142.7 | App `dispatchesApi` + mock, `AssignmentsScreen.js`, `components/dispatch/CountdownTimer.js` and `AssignmentCard.js` | Sub-task | DMS-111 |
| 237 | Lahiru | **DMS-142** ⭐ | **Merge:** Main flow (6–11): dispatch rescue team + field-app lifecycle | Story | — |
| 238 | Lahiru | DMS-146.3 | App decline sheet | Sub-task | DMS-142.7 |
| 239 | Lahiru | DMS-146.4 | Web reassign prompt + exclusion | Sub-task | DMS-142.6 |
| 240 | Lahiru | **DMS-146** ⭐ | **Merge:** A3: Team declines the assignment → choose another team | Story | — |
| 241 | Lahiru | DMS-144.3 | Web RegisterShelterDialog | Sub-task | — |
| 242 | Lahiru | **DMS-144** ⭐ | **Merge:** A1: Register a new shelter | Story | — |
| 243 | Sayuni | **DMS-153** | **Merge:** Main flow (1–11): select closed event, generate 4-section report with gap flagging | Story | — |
| 244 | Sayuni | **DMS-159** | **Merge:** E1: Invalid report parameters | Story | — |
| 245 | Sayuni | **DMS-160** | **Merge:** E2: No data for the selection | Story | — |
| 246 | Sayuni | DMS-154.5 | Web export actions + download link | Sub-task | — |
| 247 | Sayuni | DMS-161.2 | Web error + retry | Sub-task | — |
| 248 | Sayuni | **DMS-154** | **Merge:** Main flow (12–13): export report as PDF or CSV | Story | — |
| 249 | Sayuni | **DMS-161** | **Merge:** E3: Export failure → report stays on screen, retry | Story | — |
| 250 | Sayuni | DMS-156.3 | Web filter bar | Sub-task | — |
| 251 | Sayuni | **DMS-156** | **Merge:** A1: Filter report by hazard type / district / organisation | Story | — |
| 252 | Sayuni | DMS-155.1 | Contract | Sub-task | — |
| 253 | Sayuni | DMS-155.2 | ReportShare model + `ShareStatus` enum | Sub-task | — |
| 254 | Sayuni | DMS-155.3 | `ReportShareEmail` template | Sub-task | — |
| 255 | Sayuni | DMS-155.4 | ShareService | Sub-task | DMS-154 |
| 256 | Sayuni | DMS-155.6 | Server tests | Sub-task | — |

## Day 8 — Mon 5 Oct (S2)

**Goal:** Integration on real data (X-2, X-3); offline + manual location; report draft

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 257 | Anupa | DMS-123.4 | Service update + resend | Sub-task | — |
| 258 | Anupa | DMS-123.6 | Server tests | Sub-task | — |
| 259 | Anupa | DMS-123.5 | Web banner + edit mode | Sub-task | — |
| 260 | Anupa | **DMS-123** ⭐ | **Merge:** A2: Active warning already exists → update existing warning | Story | — |
| 261 | Anupa | DMS-114.1 | Report skeleton + style | Sub-task | — |
| 262 | Anupa | DMS-114.2 | Collect the UC01–UC04 critiques and improvements | Sub-task | — |
| 263 | Bineth | DMS-133.1 | `useCurrentLocation` hook | Sub-task | — |
| 264 | Bineth | DMS-133.2 | ManualLocationSheet | Sub-task | — |
| 265 | Bineth | **DMS-133** ⭐ | **Merge:** A2: GPS unavailable → set location manually | Story | — |
| 266 | Bineth | DMS-134.1 | `useConnectivity` hook + offline banner | Sub-task | — |
| 267 | Bineth | DMS-134.2 | `offlineQueue` store | Sub-task | — |
| 268 | Bineth | DMS-134.3 | `SyncService` | Sub-task | — |
| 269 | Bineth | **DMS-134** ⭐ | **Merge:** A3: No connectivity → save offline and auto-sync | Story | — |
| 270 | Lahiru | DMS-150.1 | Domain `isOverdue` + `markUnresponsive()` | Sub-task | — |
| 271 | Lahiru | DMS-150.3 | Lazy check in DispatchService reads and actions | Sub-task | — |
| 272 | Lahiru | DMS-145.1 | Contract | Sub-task | — |
| 273 | Lahiru | DMS-145.2 | `ShelterService.findNearestWithSpace` | Sub-task | — |
| 274 | Lahiru | DMS-145.3 | ShelterRedirect model + service | Sub-task | — |
| 275 | Sayuni | — | Point the UC04 fixtures at the real UC01 + UC03 models and re-run DMS-153 tests | Check | — |
| 276 | Sayuni | DMS-162.1 | ShareService failure path + `attempts` field | Sub-task | DMS-155.4 |
| 277 | Sayuni | DMS-162.2 | Retry endpoint + contract | Sub-task | — |
| 278 | Sayuni | DMS-162.4 | Server tests | Sub-task | — |
| 279 | Sayuni | DMS-155.5 | Web ShareDialog + shares list | Sub-task | — |
| 280 | Sayuni | DMS-162.3 | Web retry | Sub-task | — |
| 281 | Sayuni | **DMS-155** | **Merge:** Main flow (14–15): share report with an NGO / donor organisation | Story | — |
| 282 | Sayuni | **DMS-162** | **Merge:** E4: Sharing failure → share recorded FAILED, retry | Story | — |

## Day 9 — Tue 6 Oct (S3)

**Goal:** Deploy the demo environment; finish the remaining alternates

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 283 | Anupa | DMS-124.1 | Contract | Sub-task | — |
| 284 | Anupa | DMS-124.2 | Domain `cancel()` guard | Sub-task | — |
| 285 | Anupa | DMS-124.3 | Original-recipients query | Sub-task | — |
| 286 | Anupa | DMS-124.5 | Server tests | Sub-task | — |
| 287 | Anupa | DMS-124.4 | Web ActiveWarningsScreen + all-clear dialog | Sub-task | — |
| 288 | Anupa | **DMS-124** ⭐ | **Merge:** A3: Issue all-clear for an active warning | Story | — |
| 289 | Bineth | DMS-137.1 | RetryPolicy | Sub-task | — |
| 290 | Bineth | DMS-137.2 | Queue item states + transitions | Sub-task | — |
| 291 | Bineth | DMS-137.3 | UI states in My reports + Retry now | Sub-task | — |
| 292 | Bineth | **DMS-137** ⭐ | **Merge:** E2: Sync failure → stays on device, retried automatically | Story | — |
| 293 | Bineth | DMS-117.1 | Script template + the UC02 script | Sub-task | — |
| 294 | Lahiru | DMS-113.1 | Server deploy | Sub-task | DMS-110 |
| 295 | Lahiru | DMS-113.2 | Web static-site deploy | Sub-task | — |
| 296 | Lahiru | DMS-113.3 | Seed the shared cluster | Sub-task | DMS-110 |
| 297 | Lahiru | DMS-113.4 | Smoke test | Sub-task | — |
| 298 | Lahiru | **DMS-113** ⭐ | **Merge:** Deploy demo environment (Render API + static web portal + seeded cluster) | Task | — |
| 299 | Lahiru | DMS-145.5 | Server tests | Sub-task | — |
| 300 | Lahiru | DMS-145.4 | Web flag + suggestion + redirect button | Sub-task | — |
| 301 | Lahiru | **DMS-145** ⭐ | **Merge:** A2: Shelter near/over capacity → suggest nearest with space + redirect | Story | — |
| 302 | Sayuni | DMS-157.1 | Web Done action after export | Sub-task | — |
| 303 | Sayuni | DMS-157.2 | Server test | Sub-task | — |
| 304 | Sayuni | **DMS-157** | **Merge:** A2: Export without sharing | Story | — |
| 305 | Sayuni | DMS-158.1 | Web Close + Recent reports list | Sub-task | — |
| 306 | Sayuni | DMS-158.2 | Server test | Sub-task | — |
| 307 | Sayuni | **DMS-158** | **Merge:** A3: View only (close without exporting) | Story | — |
| 308 | Sayuni | DMS-115.1 | Screenshot checklist per UC | Sub-task | — |
| 309 | Sayuni | DMS-116.1 | Template + instructions to owners | Sub-task | — |

## Day 10 — Wed 7 Oct (S3)

**Goal:** Last exception flows; release candidate; screenshot day

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 310 | Anupa | DMS-128.1 | Contract | Sub-task | — |
| 311 | Anupa | DMS-128.2 | FallbackPolicy | Sub-task | — |
| 312 | Anupa | DMS-128.3 | Retry loop | Sub-task | — |
| 313 | Anupa | DMS-128.4 | Unreached aggregation | Sub-task | — |
| 314 | Anupa | DMS-128.6 | Server tests | Sub-task | — |
| 315 | Anupa | DMS-128.5 | Web partial-delivery panel + View-list modal | Sub-task | — |
| 316 | Anupa | **DMS-128** ⭐ | **Merge:** E3: Channel delivery failure → SMS fallback (max 3 attempts) | Story | — |
| 317 | Anupa | DMS-114.3 | Cross-UC consistency section | Sub-task | — |
| 318 | Bineth | DMS-139.1 | Domain + pure-class unit tests | Sub-task | DMS-102, DMS-103 |
| 319 | Bineth | DMS-139.2 | Service tests with fakes | Sub-task | — |
| 320 | Bineth | DMS-117.2 | Collect the UC01, UC03 and UC04 scripts from their owners | Sub-task | — |
| 321 | Lahiru | DMS-148.1 | Service branch + notify + de-duplication window | Sub-task | DMS-145.2 |
| 322 | Lahiru | DMS-148.3 | Server tests | Sub-task | — |
| 323 | Lahiru | DMS-148.2 | Web message | Sub-task | — |
| 324 | Lahiru | **DMS-148** ⭐ | **Merge:** E2: No shelter with space → inform officer + alert DMC | Story | — |
| 325 | Lahiru | DMS-149.2 | Domain/model change | Sub-task | — |
| 326 | Lahiru | DMS-149.3 | Endpoints + contract | Sub-task | — |
| 327 | Lahiru | DMS-149.5 | Server tests | Sub-task | — |
| 328 | Lahiru | DMS-149.4 | Web empty state + unassigned list | Sub-task | — |
| 329 | Lahiru | **DMS-149** ⭐ | **Merge:** E3: No team available → request DMC support, unassigned queue | Story | — |
| 330 | Lahiru | DMS-150.2 | `DispatchTimeoutJob` | Sub-task | — |
| 331 | Lahiru | DMS-150.4 | Mark-available endpoint + contract | Sub-task | — |
| 332 | Lahiru | DMS-150.6 | Server tests | Sub-task | — |
| 333 | Lahiru | DMS-150.5 | Web reassign prompt + app expired state | Sub-task | — |
| 334 | Lahiru | **DMS-150** ⭐ | **Merge:** E4: No acknowledgement before deadline → UNRESPONSIVE + reassign | Story | — |
| 335 | Sayuni | DMS-115.2 | Capture UC01 + UC04 (web) | Sub-task | UC01 + UC04 UIs merged |
| 336 | Sayuni | DMS-115.3 | Capture UC02 (app + web) | Sub-task | UC02 UIs merged |
| 337 | Sayuni | DMS-163.1 | Section unit tests (×4) with fixed datasets | Sub-task | DMS-102, DMS-103 |
| 338 | Sayuni | DMS-163.2 | GapDetector + ReportBuilder tests | Sub-task | — |

## Day 11 — Thu 8 Oct (S3)

**Goal:** Coverage signed off ≥80%; traceability; rehearsal

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 339 | Anupa | DMS-129.1 | Domain unit tests | Sub-task | DMS-102, DMS-103 |
| 340 | Anupa | DMS-129.2 | Service unit tests with fakes | Sub-task | — |
| 341 | Anupa | DMS-129.3 | Integration test files | Sub-task | — |
| 342 | Anupa | DMS-129.4 | Gap analysis | Sub-task | — |
| 343 | Anupa | DMS-129.5 | Evidence | Sub-task | — |
| 344 | Anupa | **DMS-129** ⭐ | **Merge:** UC01 server unit + integration tests (≥80% coverage) | Test | — |
| 345 | Anupa | DMS-114.4 | Proof-read + export to PDF | Sub-task | — |
| 346 | Anupa | **DMS-114** ⭐ | **Merge:** Group report: compile critique + improved designs for all four UCs | Task | — |
| 347 | Bineth | DMS-139.3 | Integration test files | Sub-task | — |
| 348 | Bineth | DMS-139.4 | Coverage gap analysis + evidence | Sub-task | — |
| 349 | Bineth | **DMS-139** ⭐ | **Merge:** UC02 server unit + integration tests (≥80% coverage) | Test | — |
| 350 | Bineth | DMS-117.3 | Rehearsal session + issue list | Sub-task | DMS-113 |
| 351 | Bineth | **DMS-117** | **Merge:** Demo rehearsal and walkthrough script (per UC, from seed accounts) | Task | — |
| 352 | Lahiru | DMS-152.1 | Domain unit tests | Sub-task | DMS-102, DMS-103 |
| 353 | Lahiru | DMS-152.2 | Service + job unit tests with FakeClock and FakeChannel | Sub-task | — |
| 354 | Lahiru | DMS-152.3 | Integration test files | Sub-task | — |
| 355 | Lahiru | DMS-152.4 | Concurrency tests | Sub-task | — |
| 356 | Lahiru | DMS-152.5 | Coverage gap analysis + evidence | Sub-task | — |
| 357 | Lahiru | **DMS-152** ⭐ | **Merge:** UC03 server unit + integration tests (≥80% coverage) | Test | — |
| 358 | Sayuni | DMS-115.4 | Capture UC03 (web + field app) | Sub-task | UC03 UIs merged |
| 359 | Sayuni | DMS-115.5 | Write the flow descriptions and place them in the report | Sub-task | — |
| 360 | Sayuni | **DMS-115** ⭐ | **Merge:** Report: implemented-UI screenshots + flow descriptions | Task | — |
| 361 | Sayuni | DMS-163.3 | Exporter, ExportService and ShareService tests (with fake storage and a failing transport) | Sub-task | — |
| 362 | Sayuni | DMS-163.4 | Integration test files | Sub-task | — |
| 363 | Sayuni | DMS-163.5 | Coverage gap analysis + evidence | Sub-task | — |
| 364 | Sayuni | **DMS-163** ⭐ | **Merge:** UC04 server unit + integration tests (≥80% coverage) | Test | — |
| 365 | Sayuni | DMS-116.2 | Collect the four matrices | Sub-task | DMS-129, DMS-139, DMS-152, DMS-163 |
| 366 | Sayuni | DMS-116.3 | Deviation log | Sub-task | — |
| 367 | Sayuni | **DMS-116** ⭐ | **Merge:** Traceability matrix + design-deviation log | Task | — |

## Day 12 — Fri 9 Oct (S3)

**Goal:** Bug fixes only until 12 PM; freeze 6 PM; submit before 11:59 PM

| # | Member | ID | Item | Type | Needs |
|---|---|---|---|---|---|
| 368 | Anupa | — | Bug fixes on own UC only (until 12 PM) | Check | — |
| 369 | Bineth | — | Bug fixes on own UC only (until 12 PM) | Check | — |
| 370 | Lahiru | DMS-119.1 | Freeze announcement (Fri 12 PM) and last-call merge list | Sub-task | — |
| 371 | Lahiru | DMS-119.2 | Release PR + tag | Sub-task | DMS-114, 115, 116, 118, 129, 139, 152, 163 |
| 372 | Lahiru | DMS-119.3 | Redeploy from the tag and smoke-test | Sub-task | — |
| 373 | Lahiru | DMS-119.4 | Submit the report + lock the branches | Sub-task | — |
| 374 | Lahiru | **DMS-119** | **Merge:** Code freeze, release PR develop→main, tag, submission | Task | — |
| 375 | Sayuni | DMS-118.3 | Final appendix | Sub-task | — |
| 376 | Sayuni | **DMS-118** ⭐ | **Merge:** Report: front page, GitHub URL, AI-prompt appendix | Task | — |

## Merge checklist (in the order they should land)

| Order | ID | Title | Member | Day |
|---|---|---|---|---|
| 1 | DMS-101 | Jira board, branch protection and PR workflow setup | Anupa | Day 0 (Sun 27 Sep) |
| 2 | DMS-104 ⭐ | Shared geography model: District, RiverBasin, TargetArea + AreaRegistry + GeoDistance | Anupa | Day 1 (Mon 28 Sep) |
| 3 | DMS-109 | Add `hazard-reports` upload folder + contract §6 update | Bineth | Day 1 (Mon 28 Sep) |
| 4 | DMS-111 ⭐ | Mobile navigation for field features (role-based tabs + inbox) | Bineth | Day 1 (Mon 28 Sep) |
| 5 | DMS-105 ⭐ | Person profile fields (homeDistrict, district, shiftDistrict, phone) + seeded citizens | Bineth | Day 2 (Tue 29 Sep) |
| 6 | DMS-103 ⭐ | Shared backend test helpers (auth tokens, user/area factories, fake clock, fake channels) | Bineth | Day 2 (Tue 29 Sep) |
| 7 | DMS-102 ⭐ | Server coverage configuration + per-UC coverage scripts + CI coverage gate | Lahiru | Day 2 (Tue 29 Sep) |
| 8 | DMS-107 ⭐ | Shared HazardEvent (incident) + Organisation models | Sayuni | Day 2 (Tue 29 Sep) |
| 9 | DMS-108 ⭐ | Web UI kit additions (Modal, ConfirmDialog, DataTable, Tabs, StatusBadge, MapView…) | Sayuni | Day 2 (Tue 29 Sep) |
| 10 | DMS-110 ⭐ | Per-domain seeders (District, People, Organisation, HazardEvent + UC hooks) | Sayuni | Day 2 (Tue 29 Sep) |
| 11 | DMS-106 ⭐ | Shared NotificationService + NotificationChannel interface + in-app inbox | Anupa | Day 3 (Wed 30 Sep) |
| 12 | DMS-112 ⭐ | API contract freeze for UC01–UC04 (review gate, Wed 30 Sep) | Lahiru | Day 3 (Wed 30 Sep) |
| 13 | DMS-120 ⭐ | Main flow (1–8): compose draft warning and preview its reach | Anupa | Day 6 (Sat 3 Oct) |
| 14 | DMS-126 ⭐ | E1: Invalid target scope | Anupa | Day 6 (Sat 3 Oct) |
| 15 | DMS-127 ⭐ | E2: No recipients in scope | Anupa | Day 6 (Sat 3 Oct) |
| 16 | DMS-121 ⭐ | Main flow (9–15): confirm, broadcast on all channels, delivery summary | Anupa | Day 6 (Sat 3 Oct) |
| 17 | DMS-130 ⭐ | Main flow (1–9): submit a hazard report from the mobile app | Bineth | Day 6 (Sat 3 Oct) |
| 18 | DMS-136 ⭐ | E1: Invalid report rejected with highlighted fields | Bineth | Day 6 (Sat 3 Oct) |
| 19 | DMS-140 ⭐ | Main flow (1–2, 14): coordination dashboard + combined operational picture | Lahiru | Day 6 (Sat 3 Oct) |
| 20 | DMS-141 ⭐ | Main flow (3–5): update shelter occupancy + status thresholds | Lahiru | Day 6 (Sat 3 Oct) |
| 21 | DMS-147 ⭐ | E1: Invalid occupancy value | Lahiru | Day 6 (Sat 3 Oct) |
| 22 | DMS-143 ⭐ | Main flow (12–13): log relief supply distribution | Lahiru | Day 6 (Sat 3 Oct) |
| 23 | DMS-151 ⭐ | E5: Insufficient stock | Lahiru | Day 6 (Sat 3 Oct) |
| 24 | DMS-122 ⭐ | A1: Escalate to warning from a CONFIRMED hazard report | Anupa | Day 7 (Sun 4 Oct) |
| 25 | DMS-125 ⭐ | A4: Officer backs out of the confirmation / discards draft | Anupa | Day 7 (Sun 4 Oct) |
| 26 | DMS-131 ⭐ | Main flow (10–15): pending queue, review and confirm (web) | Bineth | Day 7 (Sun 4 Oct) |
| 27 | DMS-135 ⭐ | A4: Possible duplicate → link to a cluster | Bineth | Day 7 (Sun 4 Oct) |
| 28 | DMS-132 ⭐ | A1: Dismiss report with a reason code | Bineth | Day 7 (Sun 4 Oct) |
| 29 | DMS-138 ⭐ | E3: Report already reviewed by another officer | Bineth | Day 7 (Sun 4 Oct) |
| 30 | DMS-142 ⭐ | Main flow (6–11): dispatch rescue team + field-app lifecycle | Lahiru | Day 7 (Sun 4 Oct) |
| 31 | DMS-146 ⭐ | A3: Team declines the assignment → choose another team | Lahiru | Day 7 (Sun 4 Oct) |
| 32 | DMS-144 ⭐ | A1: Register a new shelter | Lahiru | Day 7 (Sun 4 Oct) |
| 33 | DMS-153 | Main flow (1–11): select closed event, generate 4-section report with gap flagging | Sayuni | Day 7 (Sun 4 Oct) |
| 34 | DMS-159 | E1: Invalid report parameters | Sayuni | Day 7 (Sun 4 Oct) |
| 35 | DMS-160 | E2: No data for the selection | Sayuni | Day 7 (Sun 4 Oct) |
| 36 | DMS-154 | Main flow (12–13): export report as PDF or CSV | Sayuni | Day 7 (Sun 4 Oct) |
| 37 | DMS-161 | E3: Export failure → report stays on screen, retry | Sayuni | Day 7 (Sun 4 Oct) |
| 38 | DMS-156 | A1: Filter report by hazard type / district / organisation | Sayuni | Day 7 (Sun 4 Oct) |
| 39 | DMS-123 ⭐ | A2: Active warning already exists → update existing warning | Anupa | Day 8 (Mon 5 Oct) |
| 40 | DMS-133 ⭐ | A2: GPS unavailable → set location manually | Bineth | Day 8 (Mon 5 Oct) |
| 41 | DMS-134 ⭐ | A3: No connectivity → save offline and auto-sync | Bineth | Day 8 (Mon 5 Oct) |
| 42 | DMS-155 | Main flow (14–15): share report with an NGO / donor organisation | Sayuni | Day 8 (Mon 5 Oct) |
| 43 | DMS-162 | E4: Sharing failure → share recorded FAILED, retry | Sayuni | Day 8 (Mon 5 Oct) |
| 44 | DMS-124 ⭐ | A3: Issue all-clear for an active warning | Anupa | Day 9 (Tue 6 Oct) |
| 45 | DMS-137 ⭐ | E2: Sync failure → stays on device, retried automatically | Bineth | Day 9 (Tue 6 Oct) |
| 46 | DMS-113 ⭐ | Deploy demo environment (Render API + static web portal + seeded cluster) | Lahiru | Day 9 (Tue 6 Oct) |
| 47 | DMS-145 ⭐ | A2: Shelter near/over capacity → suggest nearest with space + redirect | Lahiru | Day 9 (Tue 6 Oct) |
| 48 | DMS-157 | A2: Export without sharing | Sayuni | Day 9 (Tue 6 Oct) |
| 49 | DMS-158 | A3: View only (close without exporting) | Sayuni | Day 9 (Tue 6 Oct) |
| 50 | DMS-128 ⭐ | E3: Channel delivery failure → SMS fallback (max 3 attempts) | Anupa | Day 10 (Wed 7 Oct) |
| 51 | DMS-148 ⭐ | E2: No shelter with space → inform officer + alert DMC | Lahiru | Day 10 (Wed 7 Oct) |
| 52 | DMS-149 ⭐ | E3: No team available → request DMC support, unassigned queue | Lahiru | Day 10 (Wed 7 Oct) |
| 53 | DMS-150 ⭐ | E4: No acknowledgement before deadline → UNRESPONSIVE + reassign | Lahiru | Day 10 (Wed 7 Oct) |
| 54 | DMS-129 ⭐ | UC01 server unit + integration tests (≥80% coverage) | Anupa | Day 11 (Thu 8 Oct) |
| 55 | DMS-114 ⭐ | Group report: compile critique + improved designs for all four UCs | Anupa | Day 11 (Thu 8 Oct) |
| 56 | DMS-139 ⭐ | UC02 server unit + integration tests (≥80% coverage) | Bineth | Day 11 (Thu 8 Oct) |
| 57 | DMS-117 | Demo rehearsal and walkthrough script (per UC, from seed accounts) | Bineth | Day 11 (Thu 8 Oct) |
| 58 | DMS-152 ⭐ | UC03 server unit + integration tests (≥80% coverage) | Lahiru | Day 11 (Thu 8 Oct) |
| 59 | DMS-115 ⭐ | Report: implemented-UI screenshots + flow descriptions | Sayuni | Day 11 (Thu 8 Oct) |
| 60 | DMS-163 ⭐ | UC04 server unit + integration tests (≥80% coverage) | Sayuni | Day 11 (Thu 8 Oct) |
| 61 | DMS-116 ⭐ | Traceability matrix + design-deviation log | Sayuni | Day 11 (Thu 8 Oct) |
| 62 | DMS-119 | Code freeze, release PR develop→main, tag, submission | Lahiru | Day 12 (Fri 9 Oct) |
| 63 | DMS-118 ⭐ | Report: front page, GitHub URL, AI-prompt appendix | Sayuni | Day 12 (Fri 9 Oct) |

_309 sub-tasks · 63 stories/tasks · 4 members · 13 days (Day 0 – Day 12)._
