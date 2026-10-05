// A hazard event's lifecycle (UC04's EventStatus). ACTIVE is the incident UC03
// coordinates against; CLOSED is what UC04 reports on. Opening and closing an
// event is seed-only in this phase.
export const EventStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
});
