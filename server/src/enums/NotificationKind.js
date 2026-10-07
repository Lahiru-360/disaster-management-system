// Which message a delivery record carried for its alert: the first broadcast,
// an update (A2) or the all-clear (A3). Not the inbox's NotificationType.
export const NotificationKind = Object.freeze({
  WARNING: 'WARNING',
  UPDATE: 'UPDATE',
  ALL_CLEAR: 'ALL_CLEAR',
});
