// Real geography client (docs/api-contract.md §7). Same signatures as
// ./mock/areasApi.js so index.js can swap between them. Errors propagate
// as-is: axios rejections already carry `error.response.data.error`.

import client from './client';

// The 25 districts, sorted by name; resolves with an array.
async function listDistricts() {
  const response = await client.get('/districts');
  return response.data.data.districts;
}

// The river basins, each with the districts it spans; resolves with an array.
async function listRiverBasins() {
  const response = await client.get('/river-basins');
  return response.data.data.riverBasins;
}

export default {
  listDistricts,
  listRiverBasins,
};
