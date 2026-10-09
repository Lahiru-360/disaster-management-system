// Real place-name search (GET /api/places?q=, docs/api-contract.md §9.8) for
// UC02 A2: a reporter with no GPS fix types a town or village instead. Same
// signature as ./mock/placesApi.js.

import client from './client';

/**
 * Places whose name starts with `q` (2-50 characters), at most 10, sorted by
 * name: `[{ id, name, district: { id, name }, location: { latitude, longitude } }]`.
 */
async function search(q) {
  const response = await client.get('/places', { params: { q } });
  return response.data.data.places;
}

export default {
  search,
};
