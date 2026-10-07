// Real dispatches client for the Rescue Team field app (docs/api-contract.md
// §13.7). Same signatures as ./mock/dispatchesApi.js. Errors propagate as-is:
// axios rejections already carry `error.response.data.error` - e.g. 409
// INVALID_DISPATCH_TRANSITION when the deadline has passed or the dispatch
// isn't in the status the action needs, 403 FORBIDDEN for another team's.

import client from './client';

// `GET /api/dispatches/mine` (§13.7.5): the team the signed-in lead leads and
// its open dispatches, newest first, then its latest closed one. Resolves with
// `{ team, dispatches }`; a lead with no team gets `{ team: null, dispatches: [] }`.
async function getMine() {
  const response = await client.get('/dispatches/mine');
  return response.data.data;
}

// `POST /api/dispatches/:id/acknowledge` (§13.7.6): ASSIGNED -> ACKNOWLEDGED.
// Resolves with `{ dispatch }`.
async function acknowledge(id) {
  const response = await client.post(`/dispatches/${id}/acknowledge`);
  return response.data.data;
}

// `POST /api/dispatches/:id/on-site` (§13.7.7): ACKNOWLEDGED -> ON_SITE.
async function markOnSite(id) {
  const response = await client.post(`/dispatches/${id}/on-site`);
  return response.data.data;
}

// `POST /api/dispatches/:id/complete` (§13.7.8): ON_SITE -> COMPLETED, and the
// team is available again.
async function complete(id) {
  const response = await client.post(`/dispatches/${id}/complete`);
  return response.data.data;
}

const dispatchesApi = {
  getMine,
  acknowledge,
  markOnSite,
  complete,
};

export default dispatchesApi;
