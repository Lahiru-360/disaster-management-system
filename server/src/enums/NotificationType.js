// What an inbox item is about, so a client can pick its icon or card. A closed
// list (api-contract §11.1): a new kind of message adds a value here and a row
// there first.
export const NotificationType = Object.freeze({
  HAZARD_ALERT: 'HAZARD_ALERT',
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
  REPORT_CONFIRMED: 'REPORT_CONFIRMED',
  REPORT_DISMISSED: 'REPORT_DISMISSED',
  ASSIGNMENT: 'ASSIGNMENT',
  SHELTER_CAPACITY: 'SHELTER_CAPACITY',
  SUPPORT_REQUEST: 'SUPPORT_REQUEST',
  DISPATCH_DECLINED: 'DISPATCH_DECLINED',
});
