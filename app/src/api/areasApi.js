// Real districts client (GET /api/districts, docs/api-contract.md §7.1). Same
// signature as ./mock/areasApi.js. Used to centre the manual-location map on
// the reporter's home district (UC02 A2).

import client from './client';

/** Every district, sorted by name: `[{ id, name, province, centroid: { lat, lng }, bounds }]`. */
async function listDistricts() {
  const response = await client.get('/districts');
  return response.data.data.districts;
}

export default {
  listDistricts,
};
