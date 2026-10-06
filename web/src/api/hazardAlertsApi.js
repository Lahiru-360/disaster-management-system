// Real hazard alerts client (docs/api-contract.md §12). Same signatures as
// ./mock/hazardAlertsApi.js so index.js can swap between them. Errors
// propagate as-is: axios rejections already carry `error.response.data.error`.

import client from './client';

// Step 2: opens a new DRAFT; resolves with { alert }.
async function startDraft() {
  const response = await client.post('/hazard-alerts', {});
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
};
