// Real hazard reports client (/api/hazard-reports, docs/api-contract.md §9).
// Keep the signatures identical to ./mock/hazardReportsApi.js. The photo is
// uploaded first through uploadApi (`folder: 'hazard-reports'`, §6) and only
// its URL is sent here.

import client from './client';

/**
 * `POST /api/hazard-reports` (§9.2) - submits a report and resolves with the
 * stored report (§9.1): `referenceNo`, `status: 'PENDING'`, ...
 * `report` is `{ description, hazardType, location: { latitude, longitude },
 * locationSource, photoUrl, clientReportId? }`. A 400 carries one
 * `errors` entry per invalid top-level field, for highlighting.
 */
async function submit(report) {
  const response = await client.post('/hazard-reports', report);
  return response.data.data.report;
}

/**
 * `GET /api/hazard-reports/mine` (§9.3) - the signed-in reporter's own
 * reports, every status, newest first.
 */
async function listMine() {
  const response = await client.get('/hazard-reports/mine');
  return response.data.data.reports;
}

export default {
  submit,
  listMine,
};
