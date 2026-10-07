// The four sections of a post-event report (UC04 steps 6-9), in the order a
// report lists them. Each key names one ReportSection strategy, and is how a
// request picks sections and a data gap names the section it belongs to.
export const ReportSectionKey = Object.freeze({
  ALERT_TIMELINE: 'alertTimeline',
  CITIZENS_REACHED: 'citizensReached',
  OCCUPANCY_OVER_TIME: 'occupancyOverTime',
  RESOURCE_DISTRIBUTION: 'resourceDistribution',
});
