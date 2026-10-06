// Mock of ../coordinationApi.js (docs/api-contract.md §13). Starts with the
// same Gampaha flood data the server's Uc03Seeder seeds - the hi-fi's five
// shelters, teams Alpha to Echo, organisation stock and recent supply logs -
// and builds the operational picture from it the way the server does
// (summary, organisation filter, totals by organisation). Any other district
// has nothing in it and no active incident. Rejects with axios-shaped errors:
// 404 for an unknown organisation. `mockControls.failNext` fakes what can't be
// clicked into: a dropped connection, or a 403 for another district.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const RECENT_DISTRIBUTIONS = 10;

const GAMPAHA = { id: '66f7c1a2b3c4d5e6f7a8b902', name: 'Gampaha' };
const INCIDENT = {
  id: '66f7c1a2b3c4d5e6f7a8b9c1',
  name: 'Flood – Gampaha District',
  hazardType: 'FLOOD',
  startDate: '2026-09-25T00:00:00.000Z',
};
const SEEDED_AT = '2026-09-30T06:00:00.000Z';

const ORGANISATIONS = {
  adra: { id: '66f7c1a2b3c4d5e6f7a8b9d1', name: 'ADRA', type: 'NGO' },
  fire: { id: '66f7c1a2b3c4d5e6f7a8b9d2', name: 'Fire Service', type: 'GOVERNMENT' },
  dmc: { id: '66f7c1a2b3c4d5e6f7a8b9d3', name: 'Government/DMC', type: 'GOVERNMENT' },
  redCross: { id: '66f7c1a2b3c4d5e6f7a8b9d4', name: 'Red Cross Sri Lanka', type: 'NGO' },
  army: { id: '66f7c1a2b3c4d5e6f7a8b9d5', name: 'SL Army', type: 'ARMED_FORCES' },
  police: { id: '66f7c1a2b3c4d5e6f7a8b9d6', name: 'Sri Lanka Police', type: 'POLICE' },
  unicef: { id: '66f7c1a2b3c4d5e6f7a8b9d7', name: 'UNICEF Sri Lanka', type: 'DONOR' },
};

// The demo accounts, numbered as the auth mock numbers them.
const DEMO_LEAD = { id: '64f1a2b3c4d5e6f7a8b9c0d3', name: 'Suresh Bandara' };
const DEMO_OFFICER = { id: '64f1a2b3c4d5e6f7a8b9c0d6', name: 'Dilani Wickramasinghe' };

const shelter = (n, name, lat, lng, label, capacity, currentOccupancy) => ({
  id: `66fb0a1b2c3d4e5f6a7b8c0${n}`,
  name,
  district: GAMPAHA,
  location: { lat, lng, label },
  capacity,
  currentOccupancy,
  redirectingTo: null,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
});

const shelters = [
  shelter(1, 'Gampaha Central College', 7.0917, 79.9999, 'Gampaha town', 500, 460),
  shelter(2, 'Minuwangoda National School', 7.1663, 79.9511, 'Minuwangoda', 400, 304),
  shelter(3, 'Attanagalla Vidyalaya', 7.1081, 80.1333, 'Attanagalla', 300, 135),
  shelter(4, 'Ja-Ela Central College', 7.0744, 79.8919, 'Ja-Ela', 350, 210),
  shelter(5, 'Divulapitiya School', 7.2228, 80.0128, 'Divulapitiya', 250, 75),
];

const team = (n, name, organisation, memberCount, lat, lng, label, lead = null) => ({
  id: `66fb0b1b2c3d4e5f6a7b8d0${n}`,
  name,
  organisation,
  district: GAMPAHA,
  memberCount,
  lead,
  baseLocation: { lat, lng, label },
  currentLocation: { lat, lng, label },
  status: 'AVAILABLE',
  currentTask: null,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
});

const teams = [
  team(1, 'Team Alpha', ORGANISATIONS.army, 8, 7.0897, 79.9925, 'Gampaha HQ', DEMO_LEAD),
  team(2, 'Team Bravo', ORGANISATIONS.police, 6, 7.076, 79.895, 'Ja-Ela'),
  team(3, 'Team Charlie', ORGANISATIONS.dmc, 7, 7.0283, 79.9214, 'Ragama'),
  team(4, 'Team Delta', ORGANISATIONS.army, 8, 7.17, 79.953, 'Minuwangoda'),
  team(5, 'Team Echo', ORGANISATIONS.fire, 6, 7.11, 80.13, 'Attanagalla'),
];

const stockRow = (n, organisation, supplyType, unit, quantityAvailable) => ({
  id: `66fb0d1b2c3d4e5f6a7b8f0${n}`,
  organisation,
  district: GAMPAHA,
  supplyType,
  unit,
  quantityAvailable,
  updatedAt: SEEDED_AT,
});

const stock = [
  stockRow(1, ORGANISATIONS.redCross, 'WATER', 'bottles', 1200),
  stockRow(2, ORGANISATIONS.dmc, 'FOOD', 'packs', 800),
  stockRow(3, ORGANISATIONS.adra, 'BLANKETS', 'units', 400),
  stockRow(4, ORGANISATIONS.army, 'MEDICINE', 'units', 150),
  stockRow(5, ORGANISATIONS.unicef, 'HYGIENE_KITS', 'units', 350),
];

const distribution = (n, stockIndex, shelterIndex, quantity, distributedAt) => {
  const row = stock[stockIndex];
  return {
    id: `66fb0e1b2c3d4e5f6a7b900${n}`,
    shelter: { id: shelters[shelterIndex].id, name: shelters[shelterIndex].name },
    stockId: row.id,
    organisation: row.organisation,
    district: GAMPAHA,
    supplyType: row.supplyType,
    unit: row.unit,
    quantity,
    distributedAt,
    loggedBy: DEMO_OFFICER,
  };
};

const distributions = [
  distribution(1, 0, 0, 500, '2026-10-03T09:00:00.000Z'),
  distribution(2, 1, 1, 200, '2026-10-03T07:45:00.000Z'),
  distribution(3, 2, 3, 100, '2026-10-03T05:50:00.000Z'),
  distribution(4, 3, 2, 50, '2026-10-03T04:15:00.000Z'),
  distribution(5, 4, 4, 150, '2026-10-03T02:40:00.000Z'),
];

let pendingFailure = null;

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiError(status, code, message) {
  const error = new Error(message);
  error.response = { status, data: { success: false, error: { code, message } } };
  return error;
}

// What axios rejects with when the request never reaches the server.
function networkError() {
  const error = new Error('Network Error');
  error.code = 'ERR_NETWORK';
  error.request = {};
  return error;
}

function takeFailure() {
  const failure = pendingFailure;
  pendingFailure = null;
  if (failure === 'network') throw networkError();
  if (failure === 'forbidden') {
    throw apiError(403, 'FORBIDDEN', 'You can only coordinate your own district.');
  }
}

// The contract's thresholds on the exact ratio, as the server's Shelter class.
function statusOf({ capacity, currentOccupancy }) {
  const scaled = currentOccupancy * 100;
  if (scaled < capacity * 75) return 'AVAILABLE';
  if (scaled < capacity * 90) return 'FILLING_UP';
  if (scaled < capacity * 100) return 'NEAR_CAPACITY';
  return 'FULL';
}

const presentShelter = (record) => ({
  ...record,
  location: { ...record.location },
  rate: record.currentOccupancy / record.capacity,
  status: statusOf(record),
});

const presentTeam = (record) => ({
  ...record,
  baseLocation: { ...record.baseLocation },
  currentLocation: { ...record.currentLocation },
});

// The mock knows one district; any other is empty (no shelters, no incident).
const inDistrict = (districtId) => !districtId || districtId === GAMPAHA.id;

function findOrganisation(organisationId) {
  if (!organisationId) return null;
  const organisation = Object.values(ORGANISATIONS).find((o) => o.id === organisationId);
  if (!organisation) throw apiError(404, 'NOT_FOUND', 'Organisation not found.');
  return organisation;
}

function totalsByOrganisation(ownTeams, ownStock, counted) {
  const totals = new Map();
  const totalFor = (organisation) => {
    if (!totals.has(organisation.id)) {
      totals.set(organisation.id, { organisation, teams: 0, stockItems: 0, distributed: 0 });
    }
    return totals.get(organisation.id);
  };
  ownTeams.forEach((t) => {
    totalFor(t.organisation).teams += 1;
  });
  ownStock.forEach((s) => {
    totalFor(s.organisation).stockItems += s.quantityAvailable;
  });
  counted.forEach((d) => {
    totalFor(d.organisation).distributed += d.quantity;
  });
  return [...totals.values()].sort((a, b) =>
    a.organisation.name.localeCompare(b.organisation.name),
  );
}

async function getOperationalPicture({ districtId, organisationId } = {}) {
  await delay();
  takeFailure();
  const organisation = findOrganisation(organisationId);
  const here = inDistrict(districtId);
  const owned = (record) => !organisation || record.organisation.id === organisation.id;

  const districtShelters = here ? shelters.map(presentShelter) : [];
  const ownTeams = here ? teams.filter(owned).map(presentTeam) : [];
  const ownStock = here ? stock.filter(owned) : [];
  const ownLogs = here ? distributions.filter(owned) : [];
  const counted = ownLogs.filter((d) => d.distributedAt >= INCIDENT.startDate);
  const recent = [...ownLogs]
    .sort((a, b) => b.distributedAt.localeCompare(a.distributedAt))
    .slice(0, RECENT_DISTRIBUTIONS)
    .map((d) => ({ ...d }));

  return {
    district: here ? GAMPAHA : { id: districtId, name: 'Other district' },
    incident: here ? { ...INCIDENT } : null,
    organisation,
    summary: {
      shelters: districtShelters.length,
      sheltersNearCapacity: districtShelters.filter((s) =>
        ['NEAR_CAPACITY', 'FULL'].includes(s.status),
      ).length,
      teams: ownTeams.length,
      teamsAvailable: ownTeams.filter((t) => t.status === 'AVAILABLE').length,
      suppliesDistributed: counted.reduce((sum, d) => sum + d.quantity, 0),
      affectedPeople: districtShelters.reduce((sum, s) => sum + s.currentOccupancy, 0),
    },
    shelters: districtShelters,
    teams: ownTeams,
    recentDistributions: recent,
    totalsByOrganisation: totalsByOrganisation(ownTeams, ownStock, counted),
  };
}

async function listShelters({ districtId } = {}) {
  await delay();
  takeFailure();
  return inDistrict(districtId) ? shelters.map(presentShelter) : [];
}

async function listRescueTeams({ districtId } = {}) {
  await delay();
  takeFailure();
  return inDistrict(districtId) ? teams.map(presentTeam) : [];
}

/**
 * Demo hooks, not part of the API: `failNext('network')` makes the next call
 * fail as if offline; `failNext('forbidden')` answers the next call with the
 * 403 a district officer gets for another district.
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
};

export default {
  getOperationalPicture,
  listShelters,
  listRescueTeams,
};
