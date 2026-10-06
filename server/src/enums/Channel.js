// The ways a hazard warning reaches a citizen. Each has its own
// NotificationChannel strategy, and every recipient gets one delivery record
// per channel.
export const Channel = Object.freeze({
  PUSH: 'PUSH',
  SMS: 'SMS',
  AUDIBLE: 'AUDIBLE',
});
