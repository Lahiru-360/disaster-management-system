// Real client for the duty officer's ground reports (UC02 review,
// /api/hazard-reports, docs/api-contract.md §9.4-9.6). Same signatures as
// ./mock/groundReportsApi.js. Errors propagate as axios rejections carrying
// `error.response.data.error` - e.g. 409 REPORT_ALREADY_REVIEWED when a
// colleague got there first (E3), 404 NOT_FOUND for another district's report.

import client from './client';

/**
 * `GET /api/hazard-reports?status=PENDING` (§9.4, step 10) - the PENDING
 * reports in the officer's shift district, as
 * `[{ clusterId, count, reports }]`, newest cluster first.
 */
async function listPending() {
  const response = await client.get('/hazard-reports', { params: { status: 'PENDING' } });
  return response.data.data.clusters;
}

/**
 * `GET /api/hazard-reports/:id` (§9.5, step 11) - `{ report, cluster }`,
 * where `cluster` is `{ clusterId, count, others }`.
 */
async function getReport(id) {
  const response = await client.get(`/hazard-reports/${id}`);
  return response.data.data;
}

/**
 * `POST /api/hazard-reports/:id/confirm` (§9.6, steps 12-14) - the updated
 * report: CONFIRMED, `reviewedBy`, `reviewedAt`, `isEscalatable: true`.
 */
async function confirm(id) {
  const response = await client.post(`/hazard-reports/${id}/confirm`);
  return response.data.data.report;
}

export default {
  listPending,
  getReport,
  confirm,
};
