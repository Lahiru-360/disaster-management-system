# 8 Implemented Application

<!-- Screenshots: the figure lines below are commented out until the PNGs are in docs/report/figures/ (DMS-115.2 to 115.4); uncomment them then. Figure numbers follow the order below. -->
<!-- Owner: Sayuni (DMS-115). One screenshot per visible state; captions "UC0X · <flow> · <state>"; files ucXX_<flow>_<state>.png from the deployed release candidate. -->

## 8.1 UC01 — Issue Hazard Warning

A DMC officer opens **Issue Warning**; the system creates a draft and shows the compose form (Figure 8.1). The officer picks a hazard type (flood, landslide, cyclone, drought) and a severity, and chooses the target scope by district or river basin. The system works out which registered citizens fall inside the scope, shows the recipient count and a message preview the officer can edit (Figure 8.2). *Confirm & Broadcast* opens a confirmation dialog listing severity, areas, recipient count and channels (Figure 8.3). Once confirmed, the warning goes out on push, SMS and audible channels, each citizen receives an alert card in their app inbox (Figure 8.5), and the officer lands on the **delivery summary** with the per-channel sent, delivered and failed counts (Figure 8.4).

The alternates: **A1** the officer escalates a confirmed ground report into a warning, with the form pre-filled and a banner pointing back to the report (Figures 8.6, 8.7); **A2** if an active warning of the same type already covers the area, the officer is offered to update it instead, which sends a new version (Figures 8.8, 8.9); **A3** the officer issues an all-clear for an active warning from the active-warnings list (Figures 8.10, 8.11); **A4** the officer backs out of the confirmation or discards the draft, and nothing is sent (Figures 8.12, 8.13). The exceptions: **E1** an invalid target scope is refused on the field (Figure 8.14); **E2** a scope with no registered recipients stops before anything is sent (Figure 8.15); **E3** when a channel fails, the system retries by SMS up to three times and the delivery summary shows the partial delivery and the citizens not reached (Figures 8.16, 8.17).

<!-- ![Figure 8.1 — UC01 · Steps 1–7 · Compose draft](figures/uc01_main_compose-form.png) -->
<!-- ![Figure 8.2 — UC01 · Step 8 · Preview and recipient count](figures/uc01_main_preview-reach.png) -->
<!-- ![Figure 8.3 — UC01 · Step 10 · Confirmation dialog](figures/uc01_main_confirm-dialog.png) -->
<!-- ![Figure 8.4 — UC01 · Step 14 · Delivery summary](figures/uc01_main_delivery-summary.png) -->
<!-- ![Figure 8.5 — UC01 · Step 13 · Citizen inbox alert](figures/uc01_main_inbox-alert-card.png) -->
<!-- ![Figure 8.6 — UC01 · A1 · Escalate to Warning on a confirmed report](figures/uc01_a1_escalate-button.png) -->
<!-- ![Figure 8.7 — UC01 · A1 · Pre-filled from confirmed report](figures/uc01_a1_prefilled-banner.png) -->
<!-- ![Figure 8.8 — UC01 · A2 · Active warning already exists](figures/uc01_a2_active-warning-banner.png) -->
<!-- ![Figure 8.9 — UC01 · A2 · Update sent (version 2)](figures/uc01_a2_update-summary.png) -->
<!-- ![Figure 8.10 — UC01 · A3 · Active warnings](figures/uc01_a3_active-warnings-list.png) -->
<!-- ![Figure 8.11 — UC01 · A3 · Issue all-clear](figures/uc01_a3_all-clear-dialog.png) -->
<!-- ![Figure 8.12 — UC01 · A4 · Back keeps the draft](figures/uc01_a4_back-from-confirmation.png) -->
<!-- ![Figure 8.13 — UC01 · A4 · Drafts](figures/uc01_a4_drafts-list.png) -->
<!-- ![Figure 8.14 — UC01 · E1 · Invalid target scope](figures/uc01_e1_invalid-scope.png) -->
<!-- ![Figure 8.15 — UC01 · E2 · No recipients in scope](figures/uc01_e2_no-recipients.png) -->
<!-- ![Figure 8.16 — UC01 · E3 · Partial delivery summary](figures/uc01_e3_partial-delivery.png) -->
<!-- ![Figure 8.17 — UC01 · E3 · Citizens not reached](figures/uc01_e3_unreached-list.png) -->

## 8.2 UC02 — Submit and Verify Hazard Report

A citizen opens **Report a Hazard** in the mobile app, takes a photo, lets the app read the GPS position, writes a short description and picks a hazard type (Figure 8.18). *Submit Report* uploads the photo and stores the report as pending with a reference number such as GR-2481; the app confirms "Submitted – pending verification" (Figure 8.20) and the report appears in *My reports* with its status (Figure 8.21). At submission the system also checks for nearby recent reports of the same type and, if it finds some, links the new one to their cluster. A duty officer then opens **Ground Reports** in the web console: the queue lists pending reports newest first with a cluster badge (Figure 8.22), and the detail panel shows the photo, map pin, location source and the cluster (Figure 8.23). Confirming the report records who reviewed it, notifies the reporter and unlocks *Escalate to Warning* (Figure 8.24).

The alternates: **A1** the officer dismisses a report with a reason, and the reporter sees it as dismissed with that reason (Figures 8.25, 8.26); **A2** when GPS is unavailable the citizen sets the location by hand (Figure 8.27); **A3** with no connectivity the report is saved on the device with an offline banner and sent automatically when the connection returns (Figures 8.28, 8.29); **A4** a possible duplicate joins an existing cluster instead of being discarded (Figure 8.30). The exceptions: **E1** an invalid report is rejected with the offending fields highlighted (Figure 8.31); **E2** a failed sync leaves the report on the device and it is retried, with a *Retry now* button (Figure 8.32); **E3** if another officer has already reviewed the report, the officer is told, the report reloads with who reviewed it and the queue refreshes (Figures 8.33, 8.34).

<!-- ![Figure 8.18 — UC02 · Steps 1–5 · Report a Hazard](figures/uc02_main_report-form.png) -->
<!-- ![Figure 8.19 — UC02 · Step 3 · GPS reading](figures/uc02_main_gps-reading.png) -->
<!-- ![Figure 8.20 — UC02 · Step 8 · Submitted](figures/uc02_main_submitted-pending.png) -->
<!-- ![Figure 8.21 — UC02 · My reports](figures/uc02_main_my-reports.png) -->
<!-- ![Figure 8.22 — UC02 · Step 10 · Pending queue](figures/uc02_main_pending-queue.png) -->
<!-- ![Figure 8.23 — UC02 · Steps 11–13 · Report detail](figures/uc02_main_report-detail.png) -->
<!-- ![Figure 8.24 — UC02 · Step 14 · Confirmed](figures/uc02_main_confirmed.png) -->
<!-- ![Figure 8.25 — UC02 · A1 · Dismiss with a reason](figures/uc02_a1_dismiss-reason.png) -->
<!-- ![Figure 8.26 — UC02 · A1 · DISMISSED with its reason](figures/uc02_a1_dismissed-in-my-reports.png) -->
<!-- ![Figure 8.27 — UC02 · A2 · Set location manually](figures/uc02_a2_set-manually.png) -->
<!-- ![Figure 8.28 — UC02 · A3 · Offline](figures/uc02_a3_offline-banner.png) -->
<!-- ![Figure 8.29 — UC02 · A3 · Auto-synced](figures/uc02_a3_synced.png) -->
<!-- ![Figure 8.30 — UC02 · A4 · Possible duplicate](figures/uc02_a4_cluster-badge.png) -->
<!-- ![Figure 8.31 — UC02 · E1 · Invalid report](figures/uc02_e1_invalid-report.png) -->
<!-- ![Figure 8.32 — UC02 · E2 · Sync failure](figures/uc02_e2_sync-failure.png) -->
<!-- ![Figure 8.33 — UC02 · E3 · Already reviewed](figures/uc02_e3_already-reviewed.png) -->
<!-- ![Figure 8.34 — UC02 · E3 · Queue refreshed](figures/uc02_e3_queue-refreshed.png) -->

## 8.3 UC03 — Coordinate Shelter and Resource Allocation

A district officer opens the **coordination dashboard**, which shows the current incident, summary cards, the shelter and rescue-team tables, recent supply logs and a live map (Figure 8.35). To record arrivals they open **Update Shelter Occupancy**, enter the number of occupants and see the live occupancy percentage and status (Figure 8.36); the dashboard row then updates its bar, percentage and badge (Figure 8.37). To send help they open **Dispatch Rescue Team**, give the location and priority, and pick from the available teams listed nearest first, with an acknowledgement deadline (Figure 8.38). The team lead sees a new assignment with a countdown in the field app (Figure 8.39), acknowledges it, and moves it to on site and completed (Figure 8.40). The officer logs relief supplies through **Log Relief Supply**, choosing the owning organisation, supply type, quantity and shelter, with the available stock always visible (Figure 8.41).

The alternates: **A1** the officer registers a new shelter, which then appears in the table and on the map (Figures 8.42, 8.43); **A2** when a shelter reaches 90% or more the dialog flags it and suggests the nearest shelter with space, with a button to redirect arrivals (Figure 8.44); **A3** when a team declines (Figure 8.52), the console prompts the officer to choose another team (Figure 8.45). The exceptions: **E1** an invalid occupancy value is refused and nothing changes (Figure 8.46); **E2** if no shelter has space the officer is told and the DMC is alerted (Figure 8.47); **E3** if no team is available the officer can request DMC support and the incident joins the unassigned queue (Figures 8.48, 8.49); **E4** if a team does not acknowledge before the deadline, the dispatch is marked unresponsive and the officer is prompted to reassign (Figure 8.50); **E5** a supply quantity above the stock is refused with the available amount shown (Figure 8.51).

<!-- ![Figure 8.35 — UC03 · Steps 1–2 · Coordination dashboard](figures/uc03_main_dashboard.png) -->
<!-- ![Figure 8.36 — UC03 · Steps 3–5 · Update Shelter Occupancy](figures/uc03_main_update-occupancy.png) -->
<!-- ![Figure 8.37 — UC03 · Step 5 · Table after the update](figures/uc03_main_dashboard-updated.png) -->
<!-- ![Figure 8.38 — UC03 · Steps 6–7 · Dispatch Rescue Team](figures/uc03_main_dispatch-dialog.png) -->
<!-- ![Figure 8.39 — UC03 · Step 10 · New assignment](figures/uc03_main_team-assignment.png) -->
<!-- ![Figure 8.40 — UC03 · Step 11 · Field lifecycle](figures/uc03_main_on-site-completed.png) -->
<!-- ![Figure 8.41 — UC03 · Steps 12–13 · Log Relief Supply](figures/uc03_main_log-supply.png) -->
<!-- ![Figure 8.42 — UC03 · A1 · Register shelter](figures/uc03_a1_register-shelter.png) -->
<!-- ![Figure 8.43 — UC03 · A1 · New shelter on the dashboard](figures/uc03_a1_new-shelter-listed.png) -->
<!-- ![Figure 8.44 — UC03 · A2 · Near capacity: nearest with space](figures/uc03_a2_alternate-suggestion.png) -->
<!-- ![Figure 8.45 — UC03 · A3 · Team declined – reassign prompt](figures/uc03_a3_declined-reassign.png) -->
<!-- ![Figure 8.46 — UC03 · E1 · Invalid occupancy](figures/uc03_e1_invalid-occupancy.png) -->
<!-- ![Figure 8.47 — UC03 · E2 · No shelter with space](figures/uc03_e2_no-shelter-dmc-alerted.png) -->
<!-- ![Figure 8.48 — UC03 · E3 · No team available](figures/uc03_e3_no-team-available.png) -->
<!-- ![Figure 8.49 — UC03 · E3 · Unassigned incidents](figures/uc03_e3_unassigned-queue.png) -->
<!-- ![Figure 8.50 — UC03 · E4 · No response – reassign](figures/uc03_e4_no-response-reassign.png) -->
<!-- ![Figure 8.51 — UC03 · E5 · Insufficient stock](figures/uc03_e5_insufficient-stock.png) -->
<!-- ![Figure 8.52 — UC03 · A3 · Decline reason in the field app](figures/uc03_a3_declined-field-app.png) -->

## 8.4 UC04 — Generate Post-Event Analysis Report

A DMC officer opens **Reports › Post-Event Analysis**, which lists only closed events. Choosing one pre-fills the dates with the event's period and ticks its districts and the four report sections (Figure 8.53). *Generate* compiles the alert timeline, citizens reached, shelter occupancy over time and resource distribution for that selection, stores the report and opens it. The report view shows four summary figures and, when some days have no records, an incomplete-data banner: those days are flagged, not left out (Figure 8.54), followed by one chart per section (Figures 8.55 to 8.58). The officer exports the report as PDF or CSV and gets "Export ready – Download" (Figure 8.59), then shares it with an organisation: the Share dialog pre-fills the organisation's contact email, takes a format and a message, and the system emails a link to the file and records the share (Figures 8.60, 8.61).

The alternates: **A1** the officer narrows the report by hazard type, district or organisation, which recompiles it as a new stored report (Figures 8.62, 8.63); **A2** after exporting the officer presses Done without sharing, and no share is made (Figure 8.64); **A3** the officer closes the report without exporting and can reopen it from Recent reports (Figure 8.65). The exceptions: **E1** an invalid date range or district selection is refused on the field (Figure 8.66); **E2** a selection with no data shows "No data for this selection" and nothing is stored (Figure 8.67); **E3** a failed export shows "Export failed – try again" with the report still on screen and a Retry button (Figure 8.68); **E4** a failed share is recorded as failed, listed with "Sharing failed – Retry", and Retry resends the same share (Figures 8.69, 8.70).

<!-- ![Figure 8.53 — UC04 · Steps 1–3 · Parameter screen](figures/uc04_main_parameters.png) -->
<!-- ![Figure 8.54 — UC04 · Step 11 · Summary figures and gap banner](figures/uc04_main_report-top.png) -->
<!-- ![Figure 8.55 — UC04 · Step 11 · Alert timeline](figures/uc04_main_alert-timeline.png) -->
<!-- ![Figure 8.56 — UC04 · Step 11 · Citizens reached](figures/uc04_main_citizens-reached.png) -->
<!-- ![Figure 8.57 — UC04 · Step 11 · Occupancy over time](figures/uc04_main_occupancy-over-time.png) -->
<!-- ![Figure 8.58 — UC04 · Step 11 · Resource distribution](figures/uc04_main_resource-distribution.png) -->
<!-- ![Figure 8.59 — UC04 · Steps 12–13 · Export ready](figures/uc04_main_export-ready.png) -->
<!-- ![Figure 8.60 — UC04 · Step 14 · Share report dialog](figures/uc04_main_share-dialog.png) -->
<!-- ![Figure 8.61 — UC04 · Step 15 · Shared](figures/uc04_main_share-confirmed.png) -->
<!-- ![Figure 8.62 — UC04 · A1 · Filtered report](figures/uc04_a1_filter-bar.png) -->
<!-- ![Figure 8.63 — UC04 · A1 · Organisation filter](figures/uc04_a1_org-filter-note.png) -->
<!-- ![Figure 8.64 — UC04 · A2 · Export without sharing](figures/uc04_a2_export-then-done.png) -->
<!-- ![Figure 8.65 — UC04 · A3 · Recent reports](figures/uc04_a3_recent-reports.png) -->
<!-- ![Figure 8.66 — UC04 · E1 · Invalid parameters](figures/uc04_e1_invalid-parameters.png) -->
<!-- ![Figure 8.67 — UC04 · E2 · No data for this selection](figures/uc04_e2_no-data.png) -->
<!-- ![Figure 8.68 — UC04 · E3 · Export failed – try again](figures/uc04_e3_export-failed.png) -->
<!-- ![Figure 8.69 — UC04 · E4 · Sharing failed – Retry](figures/uc04_e4_sharing-failed.png) -->
<!-- ![Figure 8.70 — UC04 · E4 · After Retry](figures/uc04_e4_retry-sent.png) -->
