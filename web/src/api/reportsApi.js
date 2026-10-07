// Real client for UC04 post-event reports (docs/api-contract.md §14). Same
// signatures as ./mock/reportsApi.js so index.js can swap between them. Errors
// propagate as axios rejections carrying `error.response.data.error` - e.g.
// 400 VALIDATION_ERROR with `errors` per field (E1), 404 NO_DATA_FOR_SELECTION
// (E2), 409 EVENT_NOT_CLOSED, or for an export 500 EXPORT_FAILED and 502
// STORAGE_UNAVAILABLE (E3).

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
 * `POST /api/post-event-reports/:id/exports` (§14.8, steps 12-13) - writes
 * the report as a `PDF` or `CSV` file and resolves with `{ exportId, format,
 * fileUrl, createdAt }`. E3 rejects with 500 EXPORT_FAILED or 502
 * STORAGE_UNAVAILABLE; the same call can simply be made again.
 */
async function exportReport(reportId, format) {
  const response = await client.post(`/post-event-reports/${reportId}/exports`, { format });
  return response.data.data;
}

export default {
  listClosedEvents,
  generate,
  getReport,
  listRecent,
  exportReport,
};
