// The states of a UC03 Dispatch. Which move is legal from which state lives
// with the Dispatch domain class; this only names the values.
export const DispatchStatus = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ON_SITE: 'ON_SITE',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
  UNRESPONSIVE: 'UNRESPONSIVE',
  // E3: an incident no team could take yet, waiting in the district's queue.
  // An addition to the class diagram (deviation log, DMS-149.1).
  UNASSIGNED: 'UNASSIGNED',
});
