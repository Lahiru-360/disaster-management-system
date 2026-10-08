// The outcome of sharing a post-event report with an organisation (UC04
// step 15): SENT once the email went out, FAILED when it could not be
// delivered (E4), which the officer can retry.
export const ShareStatus = Object.freeze({
  SENT: 'SENT',
  FAILED: 'FAILED',
});
