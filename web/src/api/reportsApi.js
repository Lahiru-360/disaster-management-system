// Real client for UC04 post-event reports (docs/api-contract.md §14). Same
// signatures as ./mock/reportsApi.js so index.js can swap between them. Errors
// propagate as axios rejections carrying `error.response.data.error` - e.g.
// 400 VALIDATION_ERROR with `errors` per field (E1), 404 NO_DATA_FOR_SELECTION
// (E2, also answered by refine - A1), 409 EVENT_NOT_CLOSED, or for an export 500
// EXPORT_FAILED and 502 STORAGE_UNAVAILABLE (E3), or for a share 404 NOT_FOUND (no
// such organisation) and 502 EMAIL_UNAVAILABLE (E4: the share is then recorded
// FAILED).

import client from './client';

/**
 * `GET /api/hazard-events?status=CLOSED` (§8.1, step 2) - the events a report
 * can be generated for, most recent first, each with its `districts`.
 */
async function listClosedEvents() {
  const response = await client.get('/hazard-events', { params: { status: 'CLOSED' } });
  return response.data.data.hazardEvents;
}

/**
 * `POST /api/post-event-reports` (§14.3, steps 4-11) - compiles the requested
 * sections for the event, range and districts, stores the report and
 * resolves with it (§14.2). `from` and `to` are inclusive `YYYY-MM-DD` days.
 */
async function generate({ eventId, from, to, districtIds, sections }) {
  const response = await client.post('/post-event-reports', {
    eventId,
    from,
    to,
    districtIds,
    sections,
  });
  return response.data.data.report;
}

/**
 * `GET /api/post-event-reports/:id` (§14.4) - a stored report, exactly as it
 * was generated.
 */
async function getReport(id) {
  const response = await client.get(`/post-event-reports/${id}`);
  return response.data.data.report;
}

/**
 * `GET /api/post-event-reports?eventId=` (§14.5) - the event's 20 newest
 * reports, without their summary, gaps and sections.
 */
async function listRecent(eventId) {
  const response = await client.get('/post-event-reports', { params: { eventId } });
  return response.data.data.reports;
}

/**
 * `POST /api/post-event-reports/:id/refine` (§14.12, A1) - compiles the
 * report's own selection again with the filters, which replace any it had,
 * and resolves with the new stored report. Each filter is `null` for "all";
 * at least one must be set.
 */
async function refine(id, { hazardType = null, districtId = null, organisationId = null }) {
  const response = await client.post(`/post-event-reports/${id}/refine`, {
    hazardType,
    districtId,
    organisationId,
  });
  return response.data.data.report;
}

/**
 * `POST /api/post-event-reports/:id/exports` (§14.8, steps 12-13) - writes
 * the report as a `PDF` or `CSV` file and resolves with `{ exportId, format,
 * fileUrl, createdAt }`. E3 rejects with 500 EXPORT_FAILED or 502
 * STORAGE_UNAVAILABLE; the same call can simply be made again.
 */
async function exportReport(reportId, format) {
  const response = await client.post(`/post-event-reports/${reportId}/exports`, { format });
  return response.data.data;
}

/**
 * `GET /api/organisations` (§10.1) - every organisation, by name, each with
 * its `contactEmail` (null when it has none): who a report can be shared with.
 */
async function listOrganisations() {
  const response = await client.get('/organisations');
  return response.data.data.organisations;
}

/**
 * `POST /api/post-event-reports/:id/shares` (§14.9, steps 14-15) - emails the
 * report's file in `format` (`PDF` or `CSV`; exported first if the report has
 * none yet) to `recipientEmail` and resolves with the recorded share.
 */
async function shareReport(reportId, { format, organisationId, recipientEmail, message }) {
  const response = await client.post(`/post-event-reports/${reportId}/shares`, {
    format,
    organisationId,
    recipientEmail,
    message,
  });
  return response.data.data;
}

/**
 * `GET /api/post-event-reports/:id/shares` (§14.10) - the report's shares,
 * newest first, each with its status.
 */
async function listShares(reportId) {
  const response = await client.get(`/post-event-reports/${reportId}/shares`);
  return response.data.data.shares;
}

/**
 * `POST /api/report-shares/:id/retry` (§14.11, E4) - sends a FAILED share again
 * and resolves with the same share, now SENT. Rejects with 502 EMAIL_UNAVAILABLE
 * when it fails again (the share stays FAILED) or 409 INVALID_SHARE_TRANSITION
 * when it isn't FAILED.
 */
async function retryShare(shareId) {
  const response = await client.post(`/report-shares/${shareId}/retry`);
  return response.data.data;
}

export default {
  listClosedEvents,
  generate,
  getReport,
  listRecent,
  refine,
  exportReport,
  listOrganisations,
  shareReport,
  listShares,
  retryShare,
};
