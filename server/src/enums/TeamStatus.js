// Where a rescue team is in the UC03 dispatch cycle. UNAVAILABLE is a team that
// missed an acknowledgement deadline (E4) until an officer marks it available.
export const TeamStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  DISPATCHED: 'DISPATCHED',
  ON_SITE: 'ON_SITE',
  UNAVAILABLE: 'UNAVAILABLE',
});
