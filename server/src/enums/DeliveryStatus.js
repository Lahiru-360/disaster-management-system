// Where one delivery of a warning is: QUEUED when created, then SENT (the
// channel accepted it), DELIVERED (the channel confirmed it) or FAILED.
export const DeliveryStatus = Object.freeze({
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
});
