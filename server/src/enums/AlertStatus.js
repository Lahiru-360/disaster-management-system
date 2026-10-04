// A hazard warning's lifecycle. It starts DRAFT when composing starts, becomes
// BROADCAST when sent, UPDATED after each change, and CANCELLED on all-clear.
// BROADCAST and UPDATED are the active statuses.
export const AlertStatus = Object.freeze({
  DRAFT: 'DRAFT',
  BROADCAST: 'BROADCAST',
  UPDATED: 'UPDATED',
  CANCELLED: 'CANCELLED',
});
