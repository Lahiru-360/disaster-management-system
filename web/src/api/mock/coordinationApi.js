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

const FLAGGED = ['NEAR_CAPACITY', 'FULL'];

// What officers have redirected, oldest first: { id, from, to, at } by shelter id.
const redirects = [];

// `redirectingTo` is the target of the latest redirect from the shelter, shown
// only while the shelter is NEAR_CAPACITY or FULL, as the server does.
function redirectingTo(record, status) {
  const latest = redirects.findLast((r) => r.from === record.id);
  const target = latest && shelters.find((s) => s.id === latest.to);
  return FLAGGED.includes(status) && target ? { id: target.id, name: target.name } : null;
}

const presentShelter = (record) => {
  const status = statusOf(record);
  return {
    ...record,
    location: { ...record.location },
    rate: record.currentOccupancy / record.capacity,
    status,
    redirectingTo: redirectingTo(record, status),
  };
};

// A2.2: the nearest other shelter below 90% (AVAILABLE or FILLING_UP), or null.
function nearestWithSpace(record) {
  const [nearest] = shelters
    .filter((s) => s.id !== record.id && !FLAGGED.includes(statusOf(s)))
    .map((s) => ({ shelter: s, km: haversineKm(record.location, s.location) }))
    .sort((a, b) => a.km - b.km || a.shelter.name.localeCompare(b.shelter.name));
  if (!nearest) return null;
  const saved = presentShelter(nearest.shelter);
  return {
    id: saved.id,
    name: saved.name,
    rate: saved.rate,
    status: saved.status,
    distanceKm: Math.round(nearest.km * 10) / 10,
  };
}

const presentTeam = (record) => ({
  ...record,
  baseLocation: { ...record.baseLocation },
  currentLocation: { ...record.currentLocation },
  currentTask: record.currentTask ? { ...record.currentTask } : null,
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

// A1. Mirrors the server: the name (1-100 characters), a point inside the
// world's range and a whole-number capacity of 1 or more are checked, each
// problem reported on its field (a location one on `location`); a name the
// district already uses, ignoring case and surrounding spaces, is 409
// SHELTER_NAME_TAKEN. The new shelter is empty, so AVAILABLE.
async function registerShelter({ name, location, capacity }) {
  await delay();
  takeFailure();
  const errors = [];
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (typeof name !== 'string' && name !== undefined) {
    errors.push({ field: 'name', message: 'must be text' });
  } else if (!trimmed) {
    errors.push({ field: 'name', message: 'is required' });
  } else if (trimmed.length > 100) {
    errors.push({ field: 'name', message: 'must be at most 100 characters' });
  }
  const point = location ?? {};
  const label = typeof point.label === 'string' ? point.label.trim() : null;
  if (!location) {
    errors.push({ field: 'location', message: 'is required' });
  } else if (
    !(point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180) ||
    typeof point.lat !== 'number' ||
    typeof point.lng !== 'number'
  ) {
    errors.push({
      field: 'location',
      message: 'must have a lat from -90 to 90 and a lng from -180 to 180',
    });
  } else if (point.label != null && (label === null || label.length > 200)) {
    errors.push({ field: 'location', message: 'label must be text of at most 200 characters' });
  }
  if (capacity === undefined || capacity === null) {
    errors.push({ field: 'capacity', message: 'is required' });
  } else if (!Number.isInteger(capacity) || capacity < 1) {
    errors.push({ field: 'capacity', message: 'must be a whole number, 1 or more' });
  }
  if (errors.length > 0) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = errors;
    throw error;
  }
  if (shelters.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    throw apiError(
      409,
      'SHELTER_NAME_TAKEN',
      `A shelter named "${trimmed}" already exists in ${GAMPAHA.name}.`,
    );
  }

  const now = new Date().toISOString();
  const record = {
    id: `66fb0a1b2c3d4e5f6a7b8c${String(shelters.length + 1).padStart(2, '0')}`,
    name: trimmed,
    district: GAMPAHA,
    location: { lat: point.lat, lng: point.lng, label: label || null },
    capacity,
    currentOccupancy: 0,
    redirectingTo: null,
    createdAt: now,
    updatedAt: now,
  };
  shelters.push(record);
  return presentShelter(record);
}

// Steps 3-5. Mirrors the server: a whole number, 0 or more, is valid (0 is an
// empty shelter, more than capacity shows as FULL); anything else is a 400 on
// `occupants` and changes nothing (E1). A NEAR_CAPACITY or FULL result is
// flagged with the nearest shelter that has space (A2); with none (E2) the DMC
// counts as alerted. The once-an-hour window is the server's, not simulated.
async function updateOccupancy(shelterId, occupants) {
  await delay();
  takeFailure();
  const record = shelters.find((s) => s.id === shelterId);
  if (!record) throw apiError(404, 'NOT_FOUND', 'Shelter not found.');
  if (typeof occupants !== 'number' || !Number.isInteger(occupants) || occupants < 0) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = [
      { field: 'occupants', message: 'must be a whole number, 0 or more' },
    ];
    throw error;
  }

  record.currentOccupancy = occupants;
  record.updatedAt = new Date().toISOString();
  const saved = presentShelter(record);
  const flagged = FLAGGED.includes(saved.status);
  const alternateShelter = flagged ? nearestWithSpace(record) : null;
  return {
    shelter: saved,
    rate: saved.rate,
    status: saved.status,
    flagged,
    alternateShelter,
    dmcAlerted: flagged && alternateShelter === null,
  };
}

// A2.3. Mirrors the server: another shelter that still has space (below 90%
// when it is asked) takes the new arrivals; a full one is 409 SHELTER_NO_SPACE
// and nothing is stored. The latest redirect from a shelter is its current one.
async function redirectArrivals(shelterId, toShelterId) {
  await delay();
  takeFailure();
  const from = shelters.find((s) => s.id === shelterId);
  const to = shelters.find((s) => s.id === toShelterId);
  if (!from || !to) throw apiError(404, 'NOT_FOUND', 'Shelter not found.');
  if (from.id === to.id) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = [
      { field: 'toShelterId', message: 'must be another shelter' },
    ];
    throw error;
  }
  const target = presentShelter(to);
  if (FLAGGED.includes(target.status)) {
    throw apiError(
      409,
      'SHELTER_NO_SPACE',
      `${to.name} has no spare capacity (${Math.round(target.rate * 100)}%).`,
    );
  }

  const at = new Date().toISOString();
  const stored = {
    id: `66fb0f1b2c3d4e5f6a7b91${String(redirects.length + 1).padStart(2, '0')}`,
    from: from.id,
    to: to.id,
    at,
  };
  redirects.push(stored);
  return {
    id: stored.id,
    from: { id: from.id, name: from.name },
    to: { id: to.id, name: to.name },
    district: GAMPAHA,
    by: DEMO_OFFICER,
    at,
  };
}

const presentStock = (row) => ({ ...row, organisation: { ...row.organisation } });

// `GET /api/relief-stock`: sorted by organisation name, then supply type.
async function listStock({ districtId, organisationId, supplyType } = {}) {
  await delay();
  takeFailure();
  if (!inDistrict(districtId)) return [];
  return stock
    .filter((row) => !organisationId || row.organisation.id === organisationId)
    .filter((row) => !supplyType || row.supplyType === supplyType)
    .sort(
      (a, b) =>
        a.organisation.name.localeCompare(b.organisation.name) ||
        a.supplyType.localeCompare(b.supplyType),
    )
    .map(presentStock);
}

// Steps 12-13. Mirrors the server: a whole number from 1 to what is available
// is logged and taken out of the stock; anything else is a 400 on `quantity`
// that shows what is available (E5), and changes nothing.
async function logDistribution({ shelterId, stockId, quantity }) {
  await delay();
  takeFailure();
  const row = stock.find((s) => s.id === stockId);
  const receiving = shelters.find((s) => s.id === shelterId);
  if (!row || !receiving) {
    throw apiError(404, 'NOT_FOUND', row ? 'Shelter not found.' : 'Stock not found.');
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > row.quantityAvailable) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = [
      {
        field: 'quantity',
        message:
          row.quantityAvailable === 0
            ? `no stock available (0 ${row.unit})`
            : `must be between 1 and ${row.quantityAvailable} (available)`,
      },
    ];
    throw error;
  }

  const now = new Date().toISOString();
  row.quantityAvailable -= quantity;
  row.updatedAt = now;
  const logged = {
    id: `66fb0e1b2c3d4e5f6a7b9${String(distributions.length + 1).padStart(3, '0')}`,
    shelter: { id: receiving.id, name: receiving.name },
    stockId: row.id,
    organisation: row.organisation,
    district: GAMPAHA,
    supplyType: row.supplyType,
    unit: row.unit,
    quantity,
    distributedAt: now,
    loggedBy: DEMO_OFFICER,
  };
  distributions.push(logged);
  return { distribution: { ...logged }, stock: presentStock(row) };
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ACK_TIMEOUT_MINUTES = 5;
const EARTH_RADIUS_KM = 6371;

// Straight-line distance, as the server's GeoDistance.
function haversineKm(a, b) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const dispatches = [];

// Step 7: the AVAILABLE teams, nearest the incident first (ties by name), each
// with its distance to one decimal. An empty list is E3, not an error.
async function listAvailableTeams({ lat, lng, districtId, excludeTeamIds = [] }) {
  await delay();
  takeFailure();
  if (!inDistrict(districtId)) return [];
  return teams
    .filter((t) => t.status === 'AVAILABLE' && !excludeTeamIds.includes(t.id))
    .map((t) => ({ team: t, km: haversineKm(t.currentLocation, { lat, lng }) }))
    .sort((a, b) => a.km - b.km || a.team.name.localeCompare(b.team.name))
    .map(({ team: t, km }) => ({ ...presentTeam(t), distanceKm: Math.round(km * 10) / 10 }));
}

// Steps 8-9. Mirrors the server: an AVAILABLE team becomes DISPATCHED and an
// ASSIGNED dispatch is created with its acknowledgement deadline. A team that
// is no longer AVAILABLE is 409 TEAM_NOT_AVAILABLE and nothing changes.
async function dispatchTeam({ teamId, incidentLocation, priority }) {
  await delay();
  takeFailure();
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw apiError(404, 'NOT_FOUND', 'Rescue team not found.');
  if (!PRIORITIES.includes(priority)) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = [{ field: 'priority', message: 'must be a Priority' }];
    throw error;
  }
  if (team.status !== 'AVAILABLE') {
    throw apiError(
      409,
      'TEAM_NOT_AVAILABLE',
      `${team.name} is ${team.status} and can't take a new dispatch.`,
    );
  }

  const createdAt = new Date();
  const by = DEMO_OFFICER;
  const dispatch = {
    id: `66fb0c1b2c3d4e5f6a7b8e${String(dispatches.length + 1).padStart(2, '0')}`,
    status: 'ASSIGNED',
    team: { id: team.id, name: team.name, organisation: team.organisation },
    district: GAMPAHA,
    incident: { id: INCIDENT.id, name: INCIDENT.name },
    incidentLocation: { label: null, ...incidentLocation },
    priority,
    supportRequested: false,
    createdBy: by,
    createdAt: createdAt.toISOString(),
    ackDeadline: new Date(createdAt.getTime() + ACK_TIMEOUT_MINUTES * 60 * 1000).toISOString(),
    declineReason: null,
    statusHistory: [{ status: 'ASSIGNED', at: createdAt.toISOString(), by }],
  };
  dispatches.push(dispatch);

  team.status = 'DISPATCHED';
  team.currentTask = {
    dispatchId: dispatch.id,
    status: 'ASSIGNED',
    priority,
    incidentLocation: dispatch.incidentLocation,
  };
  team.updatedAt = dispatch.createdAt;
  return { dispatch: { ...dispatch } };
}

// E3 (§13.9.1): the incident is queued as an UNASSIGNED dispatch - no team, no
// deadline - and the DMC is asked for support unless the caller says not to.
async function queueUnassigned({ incidentLocation, priority, supportRequested = true }) {
  await delay();
  takeFailure();
  if (!PRIORITIES.includes(priority)) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = [{ field: 'priority', message: 'must be a Priority' }];
    throw error;
  }

  const createdAt = new Date().toISOString();
  const by = DEMO_OFFICER;
  const dispatch = {
    id: `66fb0c1b2c3d4e5f6a7b8e${String(dispatches.length + 1).padStart(2, '0')}`,
    status: 'UNASSIGNED',
    team: null,
    district: GAMPAHA,
    incident: { id: INCIDENT.id, name: INCIDENT.name },
    incidentLocation: { label: null, ...incidentLocation },
    priority,
    supportRequested,
    createdBy: by,
    createdAt,
    ackDeadline: null,
    declineReason: null,
    statusHistory: [{ status: 'UNASSIGNED', at: createdAt, by }],
  };
  dispatches.push(dispatch);
  return { dispatch: { ...dispatch } };
}

// E3 (§13.9.2): a free team takes a queued incident. Mirrors the server: a team
// that is no longer AVAILABLE is 409 TEAM_NOT_AVAILABLE and the incident stays
// queued; one that is not UNASSIGNED any more is 409 INVALID_DISPATCH_TRANSITION.
async function assignTeam(dispatchId, teamId) {
  await delay();
  takeFailure();
  const dispatch = dispatches.find((d) => d.id === dispatchId);
  if (!dispatch) throw apiError(404, 'NOT_FOUND', 'Dispatch not found.');
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw apiError(404, 'NOT_FOUND', 'Rescue team not found.');
  if (dispatch.status !== 'UNASSIGNED') {
    throw apiError(
      409,
      'INVALID_DISPATCH_TRANSITION',
      `This dispatch is ${dispatch.status} and can't be assigned a team.`,
    );
  }
  if (team.status !== 'AVAILABLE') {
    throw apiError(
      409,
      'TEAM_NOT_AVAILABLE',
      `${team.name} is ${team.status} and can't take a new dispatch.`,
    );
  }

  const now = new Date();
  dispatch.status = 'ASSIGNED';
  dispatch.team = { id: team.id, name: team.name, organisation: team.organisation };
  dispatch.ackDeadline = new Date(now.getTime() + ACK_TIMEOUT_MINUTES * 60 * 1000).toISOString();
  dispatch.statusHistory.push({ status: 'ASSIGNED', at: now.toISOString(), by: DEMO_OFFICER });

  team.status = 'DISPATCHED';
  team.currentTask = {
    dispatchId: dispatch.id,
    status: 'ASSIGNED',
    priority: dispatch.priority,
    incidentLocation: dispatch.incidentLocation,
  };
  team.updatedAt = now.toISOString();
  return { dispatch: { ...dispatch } };
}

// E4 (§13.10.1): an UNAVAILABLE team is available again; one already AVAILABLE
// is returned as it is; one out on a dispatch is 409 INVALID_TEAM_TRANSITION.
async function markTeamAvailable(teamId) {
  await delay();
  takeFailure();
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw apiError(404, 'NOT_FOUND', 'Rescue team not found.');
  if (['DISPATCHED', 'ON_SITE'].includes(team.status)) {
    throw apiError(
      409,
      'INVALID_TEAM_TRANSITION',
      `${team.name} is ${team.status}; it becomes available when its dispatch is completed.`,
    );
  }
  if (team.status === 'UNAVAILABLE') {
    team.status = 'AVAILABLE';
    team.updatedAt = new Date().toISOString();
  }
  return presentTeam(team);
}

// Newest first, optionally only some statuses, as the server's list (§13.7.3).
async function listDispatches({ districtId, status } = {}) {
  await delay();
  takeFailure();
  if (!inDistrict(districtId)) return [];
  const statuses = [status].flat().filter(Boolean);
  return dispatches
    .filter((d) => statuses.length === 0 || statuses.includes(d.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => ({ ...d, incidentLocation: { ...d.incidentLocation } }));
}

async function listRescueTeams({ districtId } = {}) {
  await delay();
  takeFailure();
  return inDistrict(districtId) ? teams.map(presentTeam) : [];
}

/**
 * Demo hooks, not part of the API: `failNext('network')` makes the next call
 * fail as if offline; `failNext('forbidden')` answers the next call with the
 * 403 a district officer gets for another district; `declineLatest(reason)`
 * plays the team lead declining the newest assignment from the field app;
 * `freeATeam()` plays a busy team finishing its job and coming available;
 * `expireLatest()` plays the newest assignment passing its deadline unanswered.
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
  // A team coming free (a lead completing a job): the first team still
  // DISPATCHED is AVAILABLE again, so a queued incident can be assigned.
  freeATeam() {
    const team = teams.find((t) => t.status === 'DISPATCHED');
    if (!team) return;
    team.status = 'AVAILABLE';
    team.currentTask = null;
  },
  // The newest ASSIGNED dispatch passing its acknowledgement deadline (E4): it
  // is UNRESPONSIVE, with no author since the system did it, and its team is
  // UNAVAILABLE, so the next poll shows the reassign prompt.
  expireLatest() {
    const dispatch = dispatches.findLast((d) => d.status === 'ASSIGNED');
    if (!dispatch) return;
    dispatch.status = 'UNRESPONSIVE';
    dispatch.statusHistory.push({
      status: 'UNRESPONSIVE',
      at: new Date().toISOString(),
      by: null,
    });
    const team = teams.find((t) => t.id === dispatch.team.id);
    team.status = 'UNAVAILABLE';
    team.currentTask = null;
  },
  // The team lead declining the newest ASSIGNED dispatch from the field app
  // (A3): the dispatch is DECLINED with the reason and the team is AVAILABLE
  // again, so the next poll shows the reassign prompt.
  declineLatest(reason = 'Vehicle unavailable') {
    const dispatch = dispatches.findLast((d) => d.status === 'ASSIGNED');
    if (!dispatch) return;
    dispatch.status = 'DECLINED';
    dispatch.declineReason = reason;
    dispatch.statusHistory.push({
      status: 'DECLINED',
      at: new Date().toISOString(),
      by: DEMO_LEAD,
    });
    const team = teams.find((t) => t.id === dispatch.team.id);
    team.status = 'AVAILABLE';
    team.currentTask = null;
  },
};

export default {
  getOperationalPicture,
  listShelters,
  registerShelter,
  redirectArrivals,
  updateOccupancy,
  listStock,
  logDistribution,
  listAvailableTeams,
  dispatchTeam,
  queueUnassigned,
  assignTeam,
  markTeamAvailable,
  listDispatches,
  listRescueTeams,
};
