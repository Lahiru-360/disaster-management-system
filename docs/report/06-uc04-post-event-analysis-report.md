# 6 UC04 — Generate Post-Event Analysis Report

<!-- Owner: Sayuni (DMS-114.2). Follow docs/report/README.md: Part B template and the style guide. The four design figures (6.1 to 6.5) are commented out until they are exported from the UC04 PDF into docs/report/figures/ (page numbers are given beside each). -->

## 6.1 Overview

UC04 lets a DMC officer produce a statistical report once a hazard event has closed, covering the alert timeline, citizens reached, shelter occupancy over time and resource distribution by district, and share it with the NGO or donor organisations that supplied relief. The primary actor is the DMC officer; the secondary actor is the Organisation that receives a shared report. The use case is triggered after a hazard event is closed, or when an organisation asks for an accountability report. It is read-only: the data it reports on is never changed. The case study requires it directly: "The system should generate statistical reports on the timeline of alerts issued, the number of citizens reached, shelter occupancy over time, and resource distribution by district" so that "officials can evaluate response effectiveness and plan for future events" (Case_Study.pdf, p. 3).

## 6.2 Critique of the original design

### 6.2.1 Strengths

- The use case is derived straight from the case study: Group_026 names "analyzing post-event data" as one of the four core capabilities and gives it its own business use case (Group_026, p. 2 and Fig. 1 / p. 3), so the requirement has a place in the design.
- The one-line summary lists the same four contents as the requirement: alert timelines, citizens reached, shelter occupancy over time and resource distribution by district (Group_026, p. 4, UC-04 summary; Case_Study.pdf, p. 3). Nothing in the requirement is missing from the summary.
- The class diagram already models a report as its own class, separate from the alert, shelter and supply records it reads (Group_026, Fig. 2 / p. 4), which keeps the use case read-only in intent.

### 6.2.2 Functional weaknesses

Table 6.1 — UC04 functional weaknesses

| ID   | Area                 | Weakness                                                                                                                                                                                                                                           | Evidence                                                                                                  | Severity |
| ---- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| W6.1 | Requirement coverage | UC04 has no detailed design at all: no scenario, no sequence diagram, no storyboard and no wireframes. Sections 3 to 5 give these only for one selected use case per member, and UC04 is not among them.                                           | Group_026, p. 2 (structure), pp. 5 and 14 (UC-01 and UC-03 scenarios), p. 4 (UC-04 is a one-line summary) | High     |
| W6.2 | Requirement coverage | Export and sharing are not designed, although the summary says reports go to donor and NGO representatives and the case study expects officials to report on how relief was used.                                                                  | Group_026, Fig. 1 / p. 3; p. 4 (UC-04 summary); Case_Study.pdf, p. 3                                      | High     |
| W6.3 | UML correctness      | The use case diagram associates the District Officer with UC04, which contradicts the summary (DMC officers and donor or NGO representatives). The Organisation actor is not connected to the use case, although donors receive the reports.       | Group_026, Fig. 1 / p. 3 against p. 4                                                                     | Medium   |
| W6.4 | Logical soundness    | Reports are per event, but the class diagram has no event concept, so there is nothing to select or to group alerts and districts by.                                                                                                              | Group_026, Fig. 2 / p. 4                                                                                  | High     |
| W6.5 | Logical soundness    | The data model cannot produce two of the four report contents: the shelter stores only its current occupancy, so "occupancy over time" cannot be calculated, and there is no per-citizen delivery record, so "citizens reached" cannot be counted. | Group_026, Fig. 2 / p. 4; Case_Study.pdf, p. 3                                                            | High     |
| W6.6 | UML correctness      | One `StatisticalReport` class holds four unrelated calculations. This breaks the Single Responsibility principle, and adding a section means changing the class (Open/Closed). Each calculation also cannot be tested on its own.                  | Group_026, Fig. 2 / p. 4                                                                                  | Medium   |
| W6.7 | Logical soundness    | No handling of periods with missing data. Offline periods are expected in a disaster, and silently leaving them out would misrepresent the response.                                                                                               | Group_026, p. 4 (no flow mentions data gaps)                                                              | Medium   |
| W6.8 | Requirement coverage | No alternate or exception flows: invalid parameters, an empty selection, an export that fails, or a share that cannot be delivered are not considered.                                                                                             | Group_026, p. 4 (no scenario exists)                                                                      | Medium   |

### 6.2.3 Interaction-design weaknesses

Table 6.2 — UC04 interaction-design weaknesses

| ID    | Heuristic / HCI principle         | Weakness                                                                                                                                      | Evidence                                                                     | Severity |
| ----- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| W6.9  | Consistency and standards         | The command console has a "Reports" navigation item with no screen behind it, so an officer who selects it reaches nothing.                   | Group_026, dashboard hi-fi (UC-03 section), as observed in the UC04 PDF §5.1 | Medium   |
| W6.10 | Error prevention                  | With no parameter screen, nothing stops an officer asking for a report on an event that is still open, or for dates outside the event.        | Group_026, p. 4 (no UC04 screen)                                             | Medium   |
| W6.11 | Visibility of system status       | Partial figures for a period with missing data would look the same as complete ones, so a reader could take a low number for a poor response. | Group_026, p. 4 (no UC04 screen)                                             | High     |
| W6.12 | Flexibility and efficiency of use | There is no way to narrow the report to one hazard type, district or organisation, or to take it out of the screen as a file for a donor.     | Group_026, p. 4 (no UC04 screen)                                             | Low      |

## 6.3 Improved design

### 6.3.1 Use case diagram

<!-- ![Figure 6.1 — UC04 improved use case diagram](figures/uc04_usecase_1.png) -->

Figure 6.1 (UC04 PDF §2, page 4) makes the DMC Officer the primary actor and connects the Organisation to Share report, which includes Export report. The four report sections stay as includes, and Flag incomplete data, Filter report and Export report are extensions. These changes fix W6.2 and W6.3 and give the missing behaviour a place in the diagram (W6.7, W6.12).

### 6.3.2 Use case scenario

Table 6.3 — UC04 scenario (main flow, alternate flows A1–A3, exception flows E1–E4)

| Item                   | Content                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use case               | UC-04 Generate Post-Event Analysis Report                                                                                                                                                                                                                                                                        |
| Actors                 | Primary: DMC Officer. Secondary: Organisation (NGO / Donor), which receives shared reports.                                                                                                                                                                                                                      |
| Description            | After a hazard event is closed, a DMC Officer generates a statistical report covering the alert timeline, citizens reached, shelter occupancy over time and resource distribution by district. Periods with missing data are flagged, and the report can be exported and shared with NGO or donor organisations. |
| Trigger                | A hazard event has been closed, or an organisation requests an accountability report.                                                                                                                                                                                                                            |
| Preconditions          | The hazard event exists with status CLOSED. Alert, notification, occupancy and distribution records exist for the event. The DMC Officer is authenticated with reporting privileges.                                                                                                                             |
| Success postconditions | A report is generated with all four sections and any data gaps flagged. If exported, a `ReportExport` is stored. If shared, a `ReportShare` is recorded with status SENT.                                                                                                                                        |
| Failure postconditions | No file is produced and nothing is shared. Source data is never modified.                                                                                                                                                                                                                                        |
| Main 1                 | The DMC Officer opens Reports → Post-Event Analysis.                                                                                                                                                                                                                                                             |
| Main 2                 | The system lists closed hazard events.                                                                                                                                                                                                                                                                           |
| Main 3                 | The officer selects an event; the system pre-fills its date range and affected districts.                                                                                                                                                                                                                        |
| Main 4                 | The officer optionally narrows the date range or districts and selects Generate.                                                                                                                                                                                                                                 |
| Main 5                 | The system validates the parameters (range within the event period, at least one district).                                                                                                                                                                                                                      |
| Main 6                 | The system compiles the alert timeline: each alert with time, hazard type, severity, scope, updates and all-clear.                                                                                                                                                                                               |
| Main 7                 | The system compiles citizens reached: unique citizens with at least one DELIVERED notification, and the delivery rate per channel.                                                                                                                                                                               |
| Main 8                 | The system compiles shelter occupancy over time from occupancy records (daily peak per district).                                                                                                                                                                                                                |
| Main 9                 | The system compiles resource distribution by district, supply type and owning organisation.                                                                                                                                                                                                                      |
| Main 10                | The system checks each day of the range for missing records and marks gaps as "incomplete data" instead of omitting them.                                                                                                                                                                                        |
| Main 11                | The system displays the report with summary figures and the four sections.                                                                                                                                                                                                                                       |
| Main 12–13             | The officer exports the report as PDF or CSV; the system generates the file and confirms the export.                                                                                                                                                                                                             |
| Main 14–15             | The officer shares the report with an organisation (selects the organisation and recipient email); the system sends the file, records the share and confirms it.                                                                                                                                                 |
| Main 16                | The use case ends.                                                                                                                                                                                                                                                                                               |
| A1 (step 11)           | The officer filters by hazard type, district or organisation; the system recalculates and redisplays the report. Resume at step 12.                                                                                                                                                                              |
| A2 (step 14)           | The officer downloads the file and ends the use case without sharing.                                                                                                                                                                                                                                            |
| A3 (step 12)           | The officer closes the report without exporting. Nothing is stored except the generated report.                                                                                                                                                                                                                  |
| E1 (step 5)            | The date range is outside the event period, the start is after the end, or no district is selected; the system shows a validation error. Resume at step 4.                                                                                                                                                       |
| E2 (steps 6–9)         | No records exist for the selected range and districts; the system says no data is available. Resume at step 3.                                                                                                                                                                                                   |
| E3 (step 13)           | The file cannot be generated; the system reports the failure, the report stays on screen and the officer can retry.                                                                                                                                                                                              |
| E4 (step 15)           | The file cannot be delivered; the system records the share as FAILED, keeps the exported file and lets the officer retry.                                                                                                                                                                                        |

The scenario answers W6.1 and W6.8: it supplies the missing scenario and gives every failure path a flow (E1 to E4), and it adds the gap check of step 10 (W6.7) and the filter, export, share and close alternatives (W6.2, W6.12).

### 6.3.3 Class diagram

<!-- ![Figure 6.2 — UC04 improved class diagram](figures/uc04_class_1.png) -->

Figure 6.2 (UC04 PDF §3, page 5) adds `HazardEvent`, which groups alerts and affects districts, so a report can be about "an event" (W6.4). `StatisticalReport` is replaced by the `ReportSection` interface with four implementations, one per section (Strategy pattern), so each can be built and tested separately and a new section needs no change to existing code (W6.6). `DataGap`, `ReportExport` and `ReportShare` are added for incomplete periods, files and sharing (W6.2, W6.7). Each section reads from the improved classes of UC01 and UC03: `Notification` for citizens reached, `OccupancyRecord` for occupancy over time and `SupplyDistribution` for distribution, which removes the limit that the original shelter stored only its current occupancy (W6.5).

### 6.3.4 Sequence diagrams

<!-- ![Figure 6.3 — UC04 sequence diagram: generate, export and share a report](figures/uc04_sequence_1.png) -->

Figure 6.3 (UC04 PDF §4, page 6) is new, because the original had none (W6.1). The reports screen calls the report controller, which finds the closed events and asks a `ReportBuilder` for the report. The builder loops over the four `ReportSection` objects, each compiling its own result from a shared context, and marks the incomplete days. Export goes through `ExportService` and sharing through `ShareService` to the Organisation. Alternative fragments cover filtering (A1), invalid parameters (E1), no data (E2), export failure (E3) and sharing failure (E4).

### 6.3.5 Wireframes

<!-- ![Figure 6.4 — UC04 wireframe: report parameters](figures/uc04_wireframe_1.png) -->

Figure 6.4 (UC04 PDF §5.1, page 7) is the parameter screen, reached from the "Reports" item that the original console already had but never filled in (W6.9, consistency and standards). It lists only closed events and pre-fills the date range from the event, which prevents most invalid requests before they are sent (W6.10, error prevention).

<!-- ![Figure 6.5 — UC04 wireframe: report view and share dialog](figures/uc04_wireframe_2.png) -->

Figure 6.5 (UC04 PDF §5.2, page 7) is the report view and share dialog. Summary figures sit at the top, followed by the four sections with their chart types. A visible banner marks the days with incomplete data, so partial figures are never mistaken for complete ones (W6.11, visibility of system status). Filters for hazard type, district and organisation, and the Export and Share actions with a share dialog, give the officer control over the output (W6.12, flexibility and efficiency of use).

## 6.4 Change → justification

Table 6.4 — UC04 changes and their justification

| #   | Artefact                    | Change                                                                                                  | Fixes       | Justification                                                                                                                                                   |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scenario / Sequence / UI    | Full scenario, sequence diagram and wireframes for the whole use case                                   | W6.1, W6.8  | The original provided only a use case bubble and a one-line summary for this use case.                                                                          |
| 2   | Use case                    | DMC Officer as primary actor; Organisation linked to Share report, which includes Export report         | W6.2, W6.3  | The diagram linked the District Officer, contradicting the summary, and did not connect donors to the report. Export and share are the way a donor receives it. |
| 3   | Class                       | `HazardEvent` class grouping alerts and affected districts                                              | W6.4        | Reports are per event, but the original had no event concept to select or group alerts by.                                                                      |
| 4   | Class                       | `ReportSection` strategy with four implementations, replacing `StatisticalReport`                       | W6.6        | `StatisticalReport` held four unrelated calculations in one class (Single Responsibility and Open/Closed principles).                                           |
| 5   | Class                       | Sections use `OccupancyRecord` (UC03) and `Notification` (UC01)                                         | W6.5        | The original data model could not produce occupancy over time or citizens reached.                                                                              |
| 6   | Use case / Scenario / Class | Incomplete-data flagging: `DataGap`, scenario step 10 and the banner                                    | W6.7, W6.11 | Offline periods are expected in disasters; silently omitting them would misrepresent the response. Partial figures must be visible as partial.                  |
| 7   | Scenario / Class            | Export and share with failure handling: `ReportExport`, `ReportShare`, flows E3 and E4                  | W6.2, W6.8  | The summary says reports go to donors, but no export or share function was designed, and a failed delivery must be recorded and retryable.                      |
| 8   | Scenario / UI               | Parameter screen with only closed events and a pre-filled range; validation flow E1 and no-data flow E2 | W6.9, W6.10 | Stops invalid and empty requests before they are made, and gives the unused "Reports" item a screen.                                                            |
| 9   | Scenario / UI               | Filters (A1), export without sharing (A2) and view only (A3)                                            | W6.12       | Lets the officer answer a specific question, such as what one organisation distributed in one district, and leave without producing files.                      |

Every row cites at least one weakness ID, and every **High** weakness (W6.1, W6.2, W6.4, W6.5, W6.11) has at least one row.
