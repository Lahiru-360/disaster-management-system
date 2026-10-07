// Real client for UC04 post-event reports (docs/api-contract.md §14). Same
// signatures as ./mock/reportsApi.js so index.js can swap between them. Errors
// propagate as axios rejections carrying `error.response.data.error` - e.g.
// 400 VALIDATION_ERROR with `errors` per field (E1), 404 NO_DATA_FOR_SELECTION
// (E2), also answered by refine (A1) - or 409 EVENT_NOT_CLOSED.

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
 * `POST /api/post-event-reports/:id/refine` (§14.9, A1) - compiles the
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
 * `GET /api/organisations` (§10.1) - every organisation, by name, for the
 * report view's organisation filter.
 */
async function listOrganisations() {
  const response = await client.get('/organisations');
  return response.data.data.organisations;
}

export default {
  listClosedEvents,
  generate,
  getReport,
  listRecent,
  refine,
  listOrganisations,
};
