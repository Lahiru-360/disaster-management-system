// Mock of ../groundReportsApi.js (docs/api-contract.md §9.4-9.6). Starts with
// the same Colombo queue the server's Uc02Seeder seeds - the §5.2 wireframe's
// four rows, GR-2481 leading a three-report Flood cluster - and keeps the
// officer's confirmations in this module's memory (a reload starts over).
// Resolves with the shapes the real client hands back and rejects with
// axios-shaped errors: 404 for an unknown id, 409 REPORT_ALREADY_REVIEWED for a
// report that is no longer PENDING. `mockControls.failNext` fakes what can't be
// clicked into: a dropped connection, or a colleague confirming first (E3).

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

const COLOMBO = { id: '66f7c1a2b3c4d5e6f7a8b901', name: 'Colombo' };
// The demo duty officer (Kasun Silva), as the auth mock numbers the demo users.
const DEMO_OFFICER = { id: '64f1a2b3c4d5e6f7a8b9c0d5', name: 'Kasun Silva' };
const FLOOD_CLUSTER = '66f9a0c1b2c3d4e5f6a72474';

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

function seedReport({ number, hazardType, description, latitude, longitude, minutes, clusterId }) {
  const id = `66f9a0c1b2c3d4e5f6a7${number}`;
  return {
    id,
    referenceNo: `GR-${number}`,
    hazardType,
    description,
    photoUrl: `https://placehold.co/600x400/png?text=GR-${number}`,
    location: { latitude, longitude },
    locationSource: 'GPS',
    district: COLOMBO,
    reporter: { id: `64f1a2b3c4d5e6f7a8b9${number}`, role: 'citizen' },
    status: 'PENDING',
    isEscalatable: false,
    clusterId: clusterId ?? id,
    submittedAt: minutesAgo(minutes),
    reviewedBy: null,
    reviewedAt: null,
    dismissalReason: null,
    dismissalNote: null,
    clientReportId: null,
  };
}

const reports = [
  seedReport({
    number: 2470,
    hazardType: 'OTHER',
    description: 'Power line down across the lane after the storm',
    latitude: 6.9147,
    longitude: 79.8778,
    minutes: 300,
  }),
  seedReport({
    number: 2474,
    hazardType: 'RISING_RIVER_FLOOD',
    description: 'Kelani river rising fast below the Kolonnawa bridge',
    latitude: 6.9361,
    longitude: 79.8995,
    minutes: 50,
    clusterId: FLOOD_CLUSTER,
  }),
  seedReport({
    number: 2476,
    hazardType: 'BLOCKED_ROAD',
    description: 'Baseline Road blocked by a fallen tree near the junction',
    latitude: 6.9022,
    longitude: 79.8771,
    minutes: 180,
  }),
  seedReport({
    number: 2478,
    hazardType: 'RISING_RIVER_FLOOD',
    description: 'Water over the footpath next to the bridge',
    latitude: 6.9375,
    longitude: 79.9031,
    minutes: 29,
    clusterId: FLOOD_CLUSTER,
  }),
  seedReport({
    number: 2479,
    hazardType: 'LANDSLIDE',
    description: 'Crack opening on the slope above the houses',
    latitude: 6.8536,
    longitude: 79.9846,
    minutes: 110,
  }),
  seedReport({
    number: 2481,
    hazardType: 'RISING_RIVER_FLOOD',
    description: 'Water level rising near the bridge',
    latitude: 6.9382,
    longitude: 79.9012,
    minutes: 6,
    clusterId: FLOOD_CLUSTER,
  }),
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

// A queued network failure hits the next call of any kind; a queued
// 'alreadyReviewed' waits for the next confirm.
function takeFailure() {
  if (pendingFailure === 'network') {
    pendingFailure = null;
    throw networkError();
  }
}

const newestFirst = (a, b) => b.submittedAt.localeCompare(a.submittedAt);
const oldestFirst = (a, b) => a.submittedAt.localeCompare(b.submittedAt);
const copy = (report) => ({ ...report });

function findReport(id) {
  const report = reports.find((candidate) => candidate.id === id);
  if (!report) throw apiError(404, 'NOT_FOUND', 'Hazard report not found.');
  return report;
}

async function listPending() {
  await delay();
  takeFailure();
  const clusters = new Map();
  for (const report of reports.filter((r) => r.status === 'PENDING').sort(newestFirst)) {
    if (!clusters.has(report.clusterId)) {
      clusters.set(report.clusterId, { clusterId: report.clusterId, count: 0, reports: [] });
    }
    const cluster = clusters.get(report.clusterId);
    cluster.count += 1;
    cluster.reports.push(copy(report));
  }
  return [...clusters.values()];
}

async function getReport(id) {
  await delay();
  takeFailure();
  const report = findReport(id);
  const others = reports
    .filter((other) => other.clusterId === report.clusterId && other.id !== report.id)
    .sort(oldestFirst)
    .map(({ id: otherId, referenceNo, status, submittedAt }) => ({
      id: otherId,
      referenceNo,
      status,
      submittedAt,
    }));
  return {
    report: copy(report),
    cluster: { clusterId: report.clusterId, count: others.length + 1, others },
  };
}

async function confirm(id) {
  await delay();
  takeFailure();
  const report = findReport(id);
  if (pendingFailure === 'alreadyReviewed' || report.status !== 'PENDING') {
    if (pendingFailure === 'alreadyReviewed') {
      // A colleague confirmed it a moment ago.
      pendingFailure = null;
      Object.assign(report, {
        status: 'CONFIRMED',
        isEscalatable: true,
        reviewedBy: { id: '64f1a2b3c4d5e6f7a8b9c0aa', name: 'Another duty officer' },
        reviewedAt: new Date().toISOString(),
      });
    }
    throw apiError(
      409,
      'REPORT_ALREADY_REVIEWED',
      `Already reviewed – current status: ${report.status}`,
    );
  }
  Object.assign(report, {
    status: 'CONFIRMED',
    isEscalatable: true,
    reviewedBy: DEMO_OFFICER,
    reviewedAt: new Date().toISOString(),
  });
  return copy(report);
}

const REASONS = ['INACCURATE', 'DUPLICATE', 'NOT_A_HAZARD', 'INSUFFICIENT_EVIDENCE'];

async function dismiss(id, { reason, note } = {}) {
  await delay();
  takeFailure();
  if (!REASONS.includes(reason)) {
    const error = apiError(400, 'VALIDATION_ERROR', 'Request validation failed.');
    error.response.data.error.errors = [
      {
        field: 'reason',
        message: reason ? `must be one of [${REASONS.join(', ')}]` : 'is required',
      },
    ];
    throw error;
  }
  const report = findReport(id);
  if (report.status !== 'PENDING') {
    throw apiError(
      409,
      'REPORT_ALREADY_REVIEWED',
      `Already reviewed – current status: ${report.status}`,
    );
  }
  Object.assign(report, {
    status: 'DISMISSED',
    isEscalatable: false,
    dismissalReason: reason,
    dismissalNote: note?.trim() || null,
    reviewedBy: DEMO_OFFICER,
    reviewedAt: new Date().toISOString(),
  });
  return copy(report);
}

/**
 * Demo hooks, not part of the API: `failNext('network')` makes the next call
 * fail as if offline; `failNext('alreadyReviewed')` makes the next confirm
 * lose to a colleague (UC02 E3).
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
};

export default {
  listPending,
  getReport,
  confirm,
  dismiss,
};
