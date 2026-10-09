# 5 UC03 — Coordinate Shelter and Resource Allocation

<!-- Owner: Lahiru (DMS-114.2). Follow docs/report/README.md: Part B template and the style guide. -->

## 5.1 Overview

UC03 lets a district officer coordinate the response once a warning is active: tracking how full each emergency shelter is, dispatching rescue teams and logging the relief supplies handed out. The primary actor is the District Officer. The Rescue Team Lead answers dispatches from a field app, and the DMC Officer reads the combined picture. The trigger is an official warning for the district (UC01) that needs a coordinated response.

The case study sets the requirement in its "Resource and Shelter Coordination" section (Case_Study.pdf, p. 2). The system must support registering emergency shelters and tracking occupancy against capacity, dispatching rescue teams and recording their real-time status, and logging relief supplies such as food, water and medicine as they are distributed. Resources are owned by government bodies, the armed forces, NGOs and private donors, so the system "must be able to represent resources owned and controlled by different organisations while still giving DMC officers a combined operational picture". The Objective section adds that the design must be highly usable for field responders "operating under stressful, time-critical conditions" (Case_Study.pdf, p. 1). This chapter critiques Group_026's UC03 against those requirements and then presents the improved design.

## 5.2 Critique of the original design

The original UC03 is Group_026's individual component by S.R.L. Bandara (Group_026, §5, pp. 14–17). It also appears in the group use case diagram (Fig. 1 / p. 3) and class diagram (Fig. 2 / p. 4). Group_026's own figure numbers repeat across sections, so every citation below gives the figure and the page.

### 5.2.1 Strengths

- **Ownership is part of the goal.** The description requires that resources owned by different organisations "remain individually attributable" while DMC keeps one combined view (Group_026, §5.1 / p. 14). This is the central multi-agency requirement of the case study, and the improved design keeps it.
- **One screen shows the combined picture.** The high-fidelity dashboard puts shelter status, the live map, rescue teams and recent supply logs side by side, with the occupancy bars and status labels coloured and also written out ("Near Capacity", "Filling Up") (Group_026, Fig. 6 / p. 17). The improved design keeps this dashboard.
- **Near-capacity shelters are anticipated.** Alternative flow A1 flags a shelter at 90% or more and suggests the nearest alternate (Group_026, §5.1 A1 / p. 14). The improved design keeps the rule and adds what happens when no shelter is free.
- **Ownership is modelled.** `Organisation` owns both `RescueTeam` and `ReliefSupply` in the class diagram (Group_026, Fig. 2 / p. 4), so attribution has a place in the data.
- **The storyboard follows the field responder.** It shows the Rescue Team Lead receiving the assignment on a phone, not only the officer at a desk (Group_026, Fig. 4 / p. 16, panel 4).

### 5.2.2 Functional weaknesses

Table 5.1 — UC03 functional weaknesses

| ID | Area | Weakness | Evidence | Severity |
|---|---|---|---|---|
| W5.1 | Requirement coverage | The main flow forces one fixed order: update occupancy, then dispatch a team, then log supplies. Coordination is continuous and the three jobs interleave (Case_Study.pdf, p. 2). | Group_026, §5.1 Main Flow steps 2–8 / p. 14; Fig. 4 / p. 16 | Medium |
| W5.2 | Requirement coverage | Registering shelters is required by the case study and drawn in the use case diagram as an «include» of "Manage shelters", but the scenario has no flow for it. The precondition hedges that stock is registered "(or are registered as part of this flow)". | Group_026, Fig. 1 / p. 3; §5.1 Preconditions / p. 14 | Medium |
| W5.3 | Requirement coverage | The DMC Officer, for whom the combined operational picture exists, is not among the seven actors of the use case diagram, although the class diagram has a `DMCOfficer`. | Group_026, Fig. 1 / p. 3; Fig. 2 / p. 4 | Medium |
| W5.4 | Requirement coverage | Only two exceptions are handled (team unresponsive, resource owned by another organisation). Nothing covers an invalid occupancy value, a district with no shelter left, no team available, or a supply quantity larger than the stock held. | Group_026, §5.1 Exception Flows / p. 14 | High |
| W5.5 | Logical soundness | Exception E2 treats a resource owned by another organisation as an error. That is the normal case in this use case, so ownership belongs in the main flow. | Group_026, §5.1 E2 / p. 14 | Medium |
| W5.6 | Logical soundness | The storyboard shows a red Decline button for the Rescue Team Lead, but neither the scenario nor the sequence diagram says what happens after a decline. | Group_026, Fig. 4 / p. 16 (panel 4); §5.1 / p. 14; Fig. 3 / p. 15 | Medium |
| W5.7 | Logical soundness | The acknowledgement timeout is "the configured timeout" with no value, no stored deadline and no status for a team that never answers. The system has nothing to compare the clock against, and a silent team stays "dispatched" indefinitely. | Group_026, §5.1 E1 / p. 14; Fig. 2 / p. 4 | High |
| W5.8 | UML correctness | The use case diagram shows steps as use cases: "Select incident location", "Find nearest available team", "Record dispatch location", "Enter supply type and quantity", "Record owning organisation". "Organisation" is drawn as an actor although owners never use the system in this use case. | Group_026, Fig. 1 / p. 3 | Medium |
| W5.9 | UML correctness | There is no `Dispatch` class, only `DistrictOfficer.dispatchRescueTeam(t)`, so what was sent where, with what priority and when, is never recorded. There is also no occupancy history, only `Shelter.currentOccupancy`, although UC04 must report "shelter occupancy over time" (Case_Study.pdf, p. 3). | Group_026, Fig. 2 / p. 4 | High |
| W5.10 | UML correctness | `ReliefSupply` is both the stock an organisation holds (`quantity`) and the act of giving it away (`distribute(qty)`). Distributions to a shelter on a given day cannot be told apart from the stock, so "resource distribution by district" cannot be computed. | Group_026, Fig. 2 / p. 4 | High |
| W5.11 | UML correctness | Statuses are `String`s (`RescueTeam.status`), and `Shelter` has no status at all, although the scenario speaks of flagging a shelter at 90%. Nothing stops an invalid value such as "Dispached". | Group_026, Fig. 2 / p. 4; §5.1 A1 / p. 14 | Medium |
| W5.12 | UML correctness | The composition diamonds sit on the part end of the associations "District hosts Shelter" and "Shelter stores ReliefSupply", which reverses the whole–part meaning. | Group_026, Fig. 2 / p. 4 | Low |
| W5.13 | UML correctness | The sequence diagram uses generic boxes ("Shelter Management", "Rescue Team", "Resource Management") and plain-English messages ("Get shelter details"), with no Boundary, Controller or Entity roles, and squeezes three sub-flows into one tall diagram. The acknowledgement is a self-message on the team lifeline, the timeout fragment sits before the acknowledgement it is the alternative to, and neither the Rescue Team Lead nor the DMC Officer appears. | Group_026, Fig. 3 / p. 15 | Medium |

### 5.2.3 Interaction-design weaknesses

Table 5.2 — UC03 interaction-design weaknesses

| ID | Heuristic / HCI principle | Weakness | Evidence | Severity |
|---|---|---|---|---|
| W5.14 | Visibility of system status | Neither the Rescue Team App panel nor the Rescue Teams table shows an acknowledgement deadline or time left. The officer sees "Dispatched" and cannot tell whether the team has even seen the assignment. | Group_026, Fig. 4 / p. 16 (panel 4); Fig. 6 / p. 17 | Medium |
| W5.15 | Error prevention | The Log Relief Supply dialog shows a quantity (500 bottles) but not how much stock the organisation holds, so over-allocation is only discoverable after saving, and no error state is drawn. | Group_026, Fig. 4 / p. 16 (panel 5) | High |
| W5.16 | Recognition rather than recall | The Dispatch dialog offers a single "Nearest Available Team" drop-down showing one team (Team Alpha, 2.5 km). The other teams and each team's owning organisation are hidden, so the officer cannot compare options in a time-critical choice. | Group_026, Fig. 4 / p. 16 (panel 3) | Medium |
| W5.17 | Flexibility and efficiency of use | The three actions the officer performs most ("Dispatch Rescue Team", "Log Relief Supply", "Manage Shelters") sit at the bottom of a long dashboard, below all the tables, so the main tasks need scrolling. | Group_026, Fig. 5 and Fig. 6 / p. 17 | Low |
| W5.18 | Consistency and standards | The dashboard shows an "Affected People: 4,820" card, but no class in the design holds that figure. Its sample dates are from October 2024. | Group_026, Fig. 6 / p. 17; Fig. 2 / p. 4 | Low |

## 5.3 Improved design

The improved design is the corrected UC03 in `docs/Other/UC03_Coordinate_Shelter_and_Resource_Allocation_Improved_By_Lahiru.pdf`. The diagram sources are in `figures/uc03_*.puml`.

### 5.3.1 Use case diagram

![Figure 5.1 — UC03 improved use case diagram](figures/uc03_usecase_1.png)

Figure 5.1 keeps the three sub-goals (update occupancy, dispatch a team, log supply) and the combined picture as «include»s of one coordination use case, and removes the step-level use cases (W5.8). It connects the DMC Officer to "View combined operational picture" (W5.3) and adds the Rescue Team Lead with "Acknowledge / update dispatch status". It adds «extend» use cases for registering a shelter (W5.2), for suggesting an alternate shelter at 90% or more, and for reassigning a team after a decline or timeout (W5.6, W5.7). The Organisation actor is removed, because ownership is data recorded on teams and stock.

### 5.3.2 Use case scenario

Table 5.3 — UC03 scenario (main flow, alternate flows A1–A3, exception flows E1–E5)

| Flow | Step | Description |
|---|---|---|
| Header | ID, name | UC-03, Coordinate Shelter and Resource Allocation |
| Header | Actors | Primary: District Officer. Secondary: Rescue Team Lead (field app), DMC Officer (views the combined operational picture). |
| Header | Description | The District Officer tracks shelter occupancy against capacity, dispatches rescue teams and logs relief-supply distribution. Every team and supply stays attributed to its owning organisation, while DMC officers see one combined operational picture. |
| Header | Trigger | An official hazard warning is active for the district (UC01) and response coordination is required. |
| Header | Preconditions | An incident is active for the district. The District Officer is authenticated with resource-management privileges for that district. Rescue teams and relief stock are registered with their owning organisation. |
| Header | Postconditions (success) | Shelter occupancy is current, with a history record for each update. Each dispatch is recorded with its status history. Each distribution is logged against a shelter, a stock item and its owning organisation, and the stock is reduced. The combined picture reflects all changes. |
| Header | Postconditions (failure) | No records are changed and the officer is shown the reason. |
| Main | 1 | District Officer opens the Shelter & Resource Coordination dashboard for the active incident. |
| Main | 2 | System displays shelters with occupancy against capacity, rescue teams with status, recent supply logs and a live map, across all owning organisations. |
| Main | 3 | Officer selects a shelter and enters the current number of occupants. |
| Main | 4 | System validates the value, saves it and adds an occupancy history record. |
| Main | 5 | System recalculates the rate and status: Available (below 75%), Filling up (75–89%), Near capacity (90–99%), Full (100% or more). |
| Main | 6 | Officer selects an incident location on the map and sets the priority. |
| Main | 7 | System lists available teams sorted by distance, showing each team's owning organisation. |
| Main | 8 | Officer selects a team and confirms the dispatch. |
| Main | 9 | System creates a Dispatch (ASSIGNED) with an acknowledgement deadline (default 5 minutes), sets the team DISPATCHED and sends the assignment to the Team Lead's field app. |
| Main | 10 | Team Lead acknowledges, and the system marks the dispatch ACKNOWLEDGED. |
| Main | 11 | On arrival the Team Lead marks the team ON SITE, and later COMPLETED, after which the team returns to AVAILABLE. |
| Main | 12 | Officer selects the owning organisation, supply type, quantity and receiving shelter. |
| Main | 13 | System validates the quantity against that organisation's available stock, records the distribution and reduces the stock. |
| Main | 14 | System refreshes the dashboard. A DMC Officer can view the same combined picture for the district, filtered by organisation if needed. |
| Main | 15 | Use case ends. Steps 3–5, 6–11 and 12–13 are independent and can be performed in any order and repeated. |
| A1 | A1.1–A1.3 | Register a new shelter (from step 2). The officer enters name, location and capacity. The system validates (capacity above 0, name unique within the district) and creates the shelter AVAILABLE. Resume at step 2. |
| A2 | A2.1–A2.3 | Shelter near or over capacity (step 5). The status becomes NEAR_CAPACITY or FULL. The system flags it and suggests the nearest shelter with spare capacity. The officer may redirect new arrivals to it, and the redirect is recorded. Resume at step 2. |
| A3 | A3.1–A3.3 | Team declines (step 10). The Team Lead declines with a reason. The system marks the dispatch DECLINED and the team AVAILABLE, and prompts the officer to choose another team. Resume at step 7 with that team excluded. |
| E1 | E1.1–E1.2 | Invalid occupancy value (step 4). The value is negative or not a whole number. The system shows a validation error. Resume at step 3. |
| E2 | E2.1–E2.2 | No shelter with space (A2.2). No shelter in the district has spare capacity. The system tells the officer and alerts the DMC Officer. |
| E3 | E3.1–E3.2 | No team available (step 7). No team is AVAILABLE for the district. The system shows this; the officer can request support from DMC, and the incident stays in the unassigned queue. |
| E4 | E4.1–E4.2 | No acknowledgement before the deadline (step 10). The system marks the dispatch UNRESPONSIVE and the team UNAVAILABLE. The officer is prompted to reassign. Resume at step 7. |
| E5 | E5.1–E5.2 | Insufficient stock (step 13). The quantity is 0 or less, or more than the available stock. The system rejects the entry and shows the available quantity. Resume at step 12. |

The scenario treats the dashboard as a hub (W5.1), moves ownership into the main flow (W5.5), turns registration into A1 (W5.2) and adds E1–E5 (W5.4). The acknowledgement deadline of step 9 and E4 answer W5.7, and A3 answers W5.6.

### 5.3.3 Class diagram

![Figure 5.2 — UC03 improved class diagram](figures/uc03_class_1.png)

Figure 5.2 adds `Dispatch` (location, priority, status, deadline, with `acknowledge()`, `decline(reason)`, `markOnSite()`, `complete()` and `isOverdue(now)`) and `OccupancyRecord` for the occupancy history (W5.9). It splits `ReliefSupply` into `ReliefStock`, what an organisation holds, and `SupplyDistribution`, what was given to which shelter, when and by whom (W5.10). `ShelterStatus`, `TeamStatus` and `DispatchStatus` replace the `String` statuses, and `OrgType`, `Priority` and `SupplyType` are added (W5.11). The composition diamonds move to the whole (W5.12).

### 5.3.4 Sequence diagrams

![Figure 5.3 — UC03 sequence diagram (a): dashboard and shelter occupancy](figures/uc03_sequence_1.png)

Figure 5.3 covers the dashboard and the occupancy flow: the optional shelter registration (A1), the validation alternative (E1), the status calculation and, for a near-capacity shelter, the search for an alternate with the "No shelter with space – DMC alerted" branch (A2, E2).

![Figure 5.4 — UC03 sequence diagram (b): dispatch rescue team](figures/uc03_sequence_2.png)

Figure 5.4 covers dispatching. It shows the "No team available – request DMC support" alternative (E3), the creation of the `Dispatch` with its deadline, and the assignment reaching the field app through `NotificationService`. Acknowledgement, decline (A3) and no response (E4) are now alternatives after the assignment is sent, in the order they happen (W5.6, W5.7).

![Figure 5.5 — UC03 sequence diagram (c): log relief supply and combined picture](figures/uc03_sequence_3.png)

Figure 5.5 covers supply logging, with the stock check and its error branch (E5), and the DMC Officer's request for the combined picture.

The three diagrams use Boundary → Controller → Entity lifelines with method-style messages, one diagram per sub-flow, and add the Rescue Team Lead and the `FieldApp` boundary in place of the self-message (W5.13).

### 5.3.5 Wireframes

![Figure 5.6 — UC03 wireframes: Update Shelter Occupancy and Dispatch Rescue Team dialogs](figures/uc03_wireframe_1.png)

Figure 5.6 wireframes two dialogs that existed only in the storyboard. The occupancy dialog shows the percentage, the status ("92% – Near capacity") and the nearest shelter with space, with a "Redirect arrivals here" action (A2). The dispatch dialog lists teams nearest-first as a table with distance and owning organisation, and shows the acknowledgement deadline (W5.14, W5.16).

![Figure 5.7 — UC03 wireframes: Log Relief Supply dialog and Rescue Team field app](figures/uc03_wireframe_2.png)

Figure 5.7 wireframes the supply dialog, which now shows the stock available for the chosen organisation ("Available stock 1,200 bottles") so the officer sees the limit before saving (W5.15, E5). The field app shows a countdown to the deadline ("respond within 04:32") with Acknowledge and Decline, then On site and Completed (W5.14, W5.6). The improved design keeps the original dashboard high-fidelity screen (Group_026, Fig. 6 / p. 17).

## 5.4 Change → justification

Table 5.4 — UC03 changes and their justification

| # | Artefact | Change | Fixes | Justification |
|---|---|---|---|---|
| 1 | Scenario | The dashboard is a hub with three independent sub-flows (steps 3–5, 6–11, 12–13) that can be repeated in any order | W5.1 | The fixed order does not match real coordination work, where occupancy, dispatches and supplies change in parallel. |
| 2 | Scenario | "Register shelter" becomes alternate flow A1, and the ambiguous precondition is removed | W5.2 | Registration is a required capability and was drawn in the use case diagram but missing from the scenario. |
| 3 | Use case | The DMC Officer is connected to "View combined operational picture" | W5.3 | The case study requires DMC officers to have the combined picture. |
| 4 | Scenario | New exception flows E1–E5 (invalid occupancy, no shelter with space, no team, no acknowledgement, insufficient stock) | W5.4 | Each of these can happen in a real incident and was unhandled, so the system's behaviour was undefined. |
| 5 | Scenario | Organisation ownership moves into the main flow (steps 12–13) and the original E2 is dropped | W5.5 | Resources owned by different organisations are the normal case, not an exception. |
| 6 | Scenario / Sequence | Alternate flow A3, "Team declines", with the decline as an alternative in sequence diagram (b) | W5.6 | The storyboard's Decline button had no flow. The team becomes AVAILABLE again and the officer reassigns. |
| 7 | Scenario / Class | A configurable acknowledgement deadline (default 5 minutes), `Dispatch.ackDeadline`, `isOverdue(now)` and the UNRESPONSIVE status | W5.7 | A stored deadline gives the system something to compare the clock against, so a silent team is detected, not left "dispatched". |
| 8 | Use case | Step-level «include»s removed, three sub-goals kept, «extend» use cases added, the Rescue Team Lead added and the Organisation actor removed | W5.8 | Steps are not use cases, and owners never interact with the system in this use case. |
| 9 | Class | New `Dispatch` and `OccupancyRecord` classes | W5.9 | Without them nothing records what was dispatched or how occupancy changed, and UC04 needs both. |
| 10 | Class | `ReliefSupply` is split into `ReliefStock` and `SupplyDistribution` | W5.10 | Stock held and stock given are different facts, and the distribution record is what UC04 reports on. |
| 11 | Class | `ShelterStatus`, `TeamStatus`, `DispatchStatus`, `OrgType`, `Priority` and `SupplyType` enumerations | W5.11 | Enumerations make an invalid status impossible and give the thresholds a place to live. |
| 12 | Class | Composition diamonds placed on the whole | W5.12 | The original reversed the whole–part meaning. |
| 13 | Sequence | Three Boundary → Controller → Entity diagrams with method-style messages, the Rescue Team Lead and `FieldApp`, and acknowledgement, decline and timeout as alternatives after the assignment | W5.13 | The original used generic boxes, a self-message acknowledgement and a misplaced timeout, and one diagram was too long to read. |
| 14 | UI | Wireframes for the Update Shelter Occupancy and Dispatch Rescue Team dialogs, listing teams nearest-first with owning organisation and the deadline | W5.14, W5.16 | The dialogs existed only in the storyboard. The officer can now compare teams and see the deadline. |
| 15 | UI | A Log Relief Supply dialog that shows the available stock | W5.15 | Showing the limit before saving prevents over-allocation (error prevention). |
| 16 | UI | A field-app wireframe with a deadline countdown, Acknowledge and Decline, then On site and Completed | W5.14, W5.6 | The responder sees how long is left and has every action the flow needs. |

Every High weakness (W5.4, W5.7, W5.9, W5.10, W5.15) has at least one row above. Two Low weaknesses are not addressed by the improved design, which keeps the original dashboard high-fidelity screen: W5.17 (the three actions at the bottom of the page) and W5.18 (the "Affected People" card with no model behind it, and its 2024 sample dates). In the implemented dashboard the three actions sit in the incident header at the top of the page.
