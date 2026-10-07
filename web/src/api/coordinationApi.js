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
 * `PATCH /api/shelters/:id/occupancy` (§13.4.2, steps 3-5) - sets how many
 * people are in the shelter. Resolves with `{ shelter, rate, status, flagged,
 * alternateShelter, dmcAlerted }`. A value that isn't a whole number, 0 or more
 * rejects with 400 VALIDATION_ERROR on `occupants` and saves nothing.
 */
async function updateOccupancy(shelterId, occupants) {
  const response = await client.patch(`/shelters/${shelterId}/occupancy`, { occupants });
  return response.data.data;
}

/**
 * `GET /api/relief-stock` (§13.11.1) - the stock rows behind the Log Relief
 * Supply dialog, sorted by organisation then supply type. Rows with nothing
 * left are included, with `quantityAvailable: 0`. `organisationId` and
 * `supplyType` narrow it.
 */
async function listStock({ districtId, organisationId, supplyType } = {}) {
  const response = await client.get('/relief-stock', {
    params: { districtId, organisationId, supplyType },
  });
  return response.data.data.stock;
}

/**
 * `POST /api/supply-distributions` (§13.11.2, steps 12-13) - logs `quantity` of
 * one stock row going to a shelter. Resolves with `{ distribution, stock }`,
 * `stock` being the row after the withdrawal. A quantity of 0 or less, or more
 * than is available, rejects with 400 VALIDATION_ERROR on `quantity` (E5) and
 * changes nothing.
 */
async function logDistribution({ shelterId, stockId, quantity }) {
  const response = await client.post('/supply-distributions', { shelterId, stockId, quantity });
  return response.data.data;
}

/**
 * `GET /api/rescue-teams/available` (§13.6, step 7) - the district's AVAILABLE
 * teams, nearest to the incident first, each with `distanceKm` and its owning
 * organisation. `excludeTeamIds` leaves teams out (A3.3). No team available is
 * an empty list (E3), not an error.
 */
async function listAvailableTeams({ lat, lng, districtId, excludeTeamIds = [] }) {
  const response = await client.get('/rescue-teams/available', {
    params: {
      lat,
      lng,
      districtId,
      excludeTeamIds: excludeTeamIds.length > 0 ? excludeTeamIds.join(',') : undefined,
    },
  });
  return response.data.data.teams;
}

/**
 * `POST /api/dispatches` (§13.7.2, steps 8-9) - sends a team to an incident
 * location. Resolves with `{ dispatch }`, ASSIGNED, with its `ackDeadline`.
 * Rejects with 409 TEAM_NOT_AVAILABLE when another officer dispatched the team
 * first, and 409 NO_ACTIVE_INCIDENT when the district has no incident.
 */
async function dispatchTeam({ teamId, incidentLocation, priority }) {
  const response = await client.post('/dispatches', { teamId, incidentLocation, priority });
  return response.data.data;
}

/**
 * `GET /api/dispatches` (§13.7.3) - the district's dispatches, newest first,
 * at most 100. `status` is one DispatchStatus or an array of them; the console
 * asks for `['DECLINED']` to prompt a reassignment (A3.2). A district officer
 * may leave out `districtId` (their own).
 */
async function listDispatches({ districtId, status } = {}) {
  const statuses = [status].flat().filter(Boolean);
  const response = await client.get('/dispatches', {
    params: { districtId, status: statuses.length > 0 ? statuses.join(',') : undefined },
  });
  return response.data.data.dispatches;
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
  updateOccupancy,
  listStock,
  logDistribution,
  listAvailableTeams,
  dispatchTeam,
  listDispatches,
  listRescueTeams,
};
