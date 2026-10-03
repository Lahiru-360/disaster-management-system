// A hazard report's review status. Every report starts PENDING; a duty officer
// moves it to CONFIRMED or DISMISSED, and both are final.
export const ReportStatus = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  DISMISSED: 'DISMISSED',
});
