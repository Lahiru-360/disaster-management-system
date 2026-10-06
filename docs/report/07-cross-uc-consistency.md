# 7 Cross-UC Consistency

<!-- Owner: Anupa (DMS-114.3) -->

## 7.1 Shared models

_TODO: District / RiverBasin, HazardEvent, Organisation, and Notification versus the in-app UserNotification — what each is and why the use cases share it._

![Figure 7.1 — Shared-model class diagram](figures/sys_shared_models_1.png)

## 7.2 Hazard-type alignment between UC01 and UC02

_TODO: `AlertHazardType` (UC01) versus `ReportHazardType` (UC02) and the mapping used when a confirmed report is escalated to a warning._

## 7.3 Data UC04 consumes

_TODO: UC04 reads `HazardAlert` and `Notification` from UC01, and `OccupancyRecord` and `SupplyDistribution` from UC03, without modifying them._
