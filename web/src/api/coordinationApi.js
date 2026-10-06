// Real client for UC03 shelter and resource coordination (docs/api-contract.md
// §13). Same signatures as ./mock/coordinationApi.js. Errors propagate as axios
// rejections carrying `error.response.data.error` - e.g. 403 FORBIDDEN for a
// district officer asking about another district, 404 NOT_FOUND for an
// unknown district or organisation.

import client from './client';

/**
 * `GET /api/operational-picture` (§13.3, steps 1-2 and 14) - the combined
 * picture `{ district, incident, organisation, summary, shelters, teams,
 * recentDistributions, totalsByOrganisation }`. A district officer may leave
 * out `districtId` (their own); a DMC officer must give it. `organisationId`
 * narrows teams, stock and distributions to one owner.
 */
async function getOperationalPicture({ districtId, organisationId } = {}) {
  const response = await client.get('/operational-picture', {
    params: { districtId, organisationId },
  });
  return response.data.data;
}

/**
 * `GET /api/shelters` (§13.4.1) - the district's shelters, each with its
 * occupancy `rate` and `status`, sorted by name.
 */
async function listShelters({ districtId } = {}) {
  const response = await client.get('/shelters', { params: { districtId } });
  return response.data.data.shelters;
}

/**
 * `GET /api/rescue-teams` (§13.5) - the district's rescue teams, each with its
 * owning organisation and status, sorted by name.
 */
async function listRescueTeams({ districtId } = {}) {
  const response = await client.get('/rescue-teams', { params: { districtId } });
  return response.data.data.teams;
}

export default {
  getOperationalPicture,
  listShelters,
  listRescueTeams,
};
