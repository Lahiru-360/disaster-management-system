// Real hazard alerts client (docs/api-contract.md §12). Same signatures as
// ./mock/hazardAlertsApi.js so index.js can swap between them. Errors
// propagate as-is: axios rejections already carry `error.response.data.error`.

import client from './client';

// Step 2: opens a new DRAFT; resolves with { alert }. With a sourceReportId
// it escalates that confirmed report instead (A1, §12.10) and resolves with
// { alert, prefill }.
async function startDraft({ sourceReportId } = {}) {
  const response = await client.post('/hazard-alerts', sourceReportId ? { sourceReportId } : {});
  return response.data.data;
}

// Steps 3-7: resolves with { alert, recipientCount, message, channels, activeWarning }.
async function preview(id, { hazardType, severity, areaIds }) {
  const response = await client.post(`/hazard-alerts/${id}/preview`, {
    hazardType,
    severity,
    areaIds,
  });
  return response.data.data;
}

// Step 8: saves the edited message; resolves with { alert }.
async function saveDraftMessage(id, message) {
  const response = await client.patch(`/hazard-alerts/${id}/draft`, { message });
  return response.data.data;
}

// One alert in any status; resolves with { alert }.
async function getById(id) {
  const response = await client.get(`/hazard-alerts/${id}`);
  return response.data.data;
}

// Steps 11-14: broadcasts the DRAFT with the message the officer confirmed;
// resolves with { alert, summary }.
async function broadcast(id, message) {
  const response = await client.post(`/hazard-alerts/${id}/broadcast`, { message });
  return response.data.data;
}

// A4: every DRAFT, most recently changed first; resolves with { alerts }.
async function listDrafts() {
  const response = await client.get('/hazard-alerts', { params: { status: 'draft' } });
  return response.data.data;
}

// A4: throws a DRAFT away, nothing sent; resolves with { alert } as it was.
async function discardDraft(id) {
  const response = await client.delete(`/hazard-alerts/${id}`);
  return response.data.data;
}

// A2 (§12.13): what updating an active alert to this severity and/or scope
// would send, changing nothing; resolves with { alert, nextVersion,
// recipientCount, message, channels, activeWarning }.
async function previewUpdate(id, { severity, areaIds }) {
  const response = await client.post(`/hazard-alerts/${id}/update-preview`, { severity, areaIds });
  return response.data.data;
}

// A2.3 (§12.14): updates the active alert and sends the update; with
// replacesDraftId, the new draft that found it is then discarded. Resolves
// with { alert, summary }.
async function update(id, { severity, areaIds, message, replacesDraftId }) {
  const response = await client.patch(`/hazard-alerts/${id}`, {
    severity,
    areaIds,
    message,
    replacesDraftId,
  });
  return response.data.data;
}

// Step 14: the per-channel counts; resolves with { alert, summary }.
async function getDeliverySummary(id) {
  const response = await client.get(`/hazard-alerts/${id}/delivery-summary`);
  return response.data.data;
}

export default {
  startDraft,
  preview,
  saveDraftMessage,
  getById,
  broadcast,
  getDeliverySummary,
  listDrafts,
  discardDraft,
  previewUpdate,
  update,
};
