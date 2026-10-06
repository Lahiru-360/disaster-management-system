// Mock of ../areasApi.js (docs/api-contract.md §7). Resolves with the same
// shapes the real client hands back, from ./areaFixtures.js, and rejects with
// axios-shaped errors. `mockControls.failNext` fakes a dropped connection or
// a server error, which can't be triggered by clicking.

import { DISTRICTS, RIVER_BASINS } from './areaFixtures';

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

let pendingFailure = null;

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fakes the next call's failure, then goes back to normal.
function takeFailure() {
  const failure = pendingFailure;
  pendingFailure = null;
  if (failure === 'network') {
    const error = new Error('Network Error');
    error.code = 'ERR_NETWORK';
    throw error;
  }
  if (failure === 'server') {
    const error = new Error('Something went wrong. Please try again.');
    error.response = {
      status: 500,
      data: {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      },
    };
    throw error;
  }
}

const byName = (a, b) => a.name.localeCompare(b.name);

async function listDistricts() {
  await delay();
  takeFailure();
  return DISTRICTS.map(({ id, name, province }) => ({ id, name, province })).sort(byName);
}

async function listRiverBasins() {
  await delay();
  takeFailure();
  return RIVER_BASINS.map(({ id, name, districts }) => ({
    id,
    name,
    districts: [...districts].sort(byName),
  })).sort(byName);
}

/**
 * Demo hook, not part of the API: `failNext('network')` makes the next call
 * fail as if offline, `failNext('server')` as a 500.
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
};

export default {
  listDistricts,
  listRiverBasins,
};
