// Mock of ../dispatchesApi.js (docs/api-contract.md §13.7). Resolves with the
// same shapes the real client hands back and rejects with axios-shaped errors,
// so swapping in the real client changes no calling code. It keeps the
// server's own rules: a dispatch past its deadline is UNRESPONSIVE before any
// action is tried, and an action the status doesn't allow is a 409
// INVALID_DISPATCH_TRANSITION. `mockControls.failNext` fakes the failures that
// can't be tapped in; `mockControls.assign` sends Team Alpha a new assignment.
//
// One team, Team Alpha, led by the demo rescue team lead, in this module's
// memory, so reloading the app resets it.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const ACK_TIMEOUT_MINUTES = 5;

const GAMPAHA = { id: '66f7c1a2b3c4d5e6f7a8b902', name: 'Gampaha' };
const SL_ARMY = { id: '66f7c1a2b3c4d5e6f7a8b9d5', name: 'SL Army', type: 'ARMED_FORCES' };
const DEMO_LEAD = { id: '64f1a2b3c4d5e6f7a8b9c0d3', name: 'Suresh Bandara' };
const DEMO_OFFICER = { id: '64f1a2b3c4d5e6f7a8b9c0d6', name: 'Dilani Wickramasinghe' };
const INCIDENT = { id: '66f7c1a2b3c4d5e6f7a8b9c1', name: 'Flood – Gampaha District' };

const team = {
  id: '66fb0b1b2c3d4e5f6a7b8d01',
  name: 'Team Alpha',
  organisation: SL_ARMY,
  district: GAMPAHA,
  memberCount: 8,
  lead: DEMO_LEAD,
  baseLocation: { lat: 7.0897, lng: 79.9925, label: 'Gampaha HQ' },
  // About 2.5 km from the incident below, as in the wireframe.
  currentLocation: { lat: 6.978, lng: 79.9865, label: 'Gampaha HQ' },
  status: 'DISPATCHED',
  currentTask: null,
};

const OPEN = ['ASSIGNED', 'ACKNOWLEDGED', 'ON_SITE'];

const VERBS = {
  ACKNOWLEDGED: 'acknowledged',
  ON_SITE: 'marked on site',
  COMPLETED: 'completed',
};

let pendingFailure = null;
let nextId = 1;

function newDispatch({ label, lat, lng, priority, secondsToRespond }) {
  const createdAt = new Date().toISOString();
  return {
    id: `66fb0c1b2c3d4e5f6a7b8e${String(nextId++).padStart(2, '0')}`,
    status: 'ASSIGNED',
    team: { id: team.id, name: team.name, organisation: team.organisation },
    district: GAMPAHA,
    incident: INCIDENT,
    incidentLocation: { lat, lng, label },
    priority,
    supportRequested: false,
    createdBy: DEMO_OFFICER,
    createdAt,
    ackDeadline: new Date(Date.now() + secondsToRespond * 1000).toISOString(),
    declineReason: null,
    statusHistory: [{ status: 'ASSIGNED', at: createdAt, by: DEMO_OFFICER }],
  };
}

// Newest first. The first is the wireframe's card: 04:32 left to respond.
const dispatches = [
  newDispatch({
    label: 'Biyagama – flooded road',
    lat: 6.9555,
    lng: 79.9865,
    priority: 'HIGH',
    secondsToRespond: 4 * 60 + 32,
  }),
];

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiError(status, code, message) {
  const error = new Error(message);
  error.response = { status, data: { success: false, error: { code, message } } };
  return error;
}

// What axios rejects with when the request never got a response.
function networkError() {
  const error = new Error('Network Error');
  error.code = 'ERR_NETWORK';
  return error;
}

// Fakes the next call's failure, then goes back to normal.
function takeFailure() {
  const failure = pendingFailure;
  pendingFailure = null;
  if (failure === 'network') {
    throw networkError();
  }
  if (failure === 'server') {
    throw apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
}

function record(dispatch, status, by = DEMO_LEAD) {
  dispatch.status = status;
  dispatch.statusHistory.push({ status, at: new Date().toISOString(), by });
}

// The server marks an overdue dispatch UNRESPONSIVE before it answers or acts.
function expireOverdue() {
  dispatches
    .filter((d) => d.status === 'ASSIGNED' && Date.now() > new Date(d.ackDeadline).getTime())
    .forEach((d) => {
      record(d, 'UNRESPONSIVE', null);
      team.status = 'UNAVAILABLE';
    });
}

const copy = (dispatch) => ({
  ...dispatch,
  incidentLocation: { ...dispatch.incidentLocation },
  statusHistory: dispatch.statusHistory.map((entry) => ({ ...entry })),
});

function currentTask() {
  const open = dispatches.find((d) => OPEN.includes(d.status));
  return open
    ? {
        dispatchId: open.id,
        status: open.status,
        priority: open.priority,
        incidentLocation: { ...open.incidentLocation },
      }
    : null;
}

// Runs an action the way the server does: the dispatch must exist and be in
// the status the action needs (it is always this lead's team's here).
function transition(id, from, to, afterwards) {
  expireOverdue();
  const dispatch = dispatches.find((d) => d.id === id);
  if (!dispatch) {
    throw apiError(404, 'NOT_FOUND', 'Dispatch not found.');
  }
  if (dispatch.status !== from) {
    throw apiError(
      409,
      'INVALID_DISPATCH_TRANSITION',
      `This dispatch is ${dispatch.status} and can't be ${VERBS[to]}.`,
    );
  }
  record(dispatch, to);
  afterwards?.(dispatch);
  return { dispatch: copy(dispatch) };
}

async function getMine() {
  await delay();
  takeFailure();
  expireOverdue();

  const open = dispatches.filter((d) => OPEN.includes(d.status));
  const lastClosed = dispatches.find((d) => !OPEN.includes(d.status));
  return {
    team: {
      ...team,
      baseLocation: { ...team.baseLocation },
      currentLocation: { ...team.currentLocation },
      currentTask: currentTask(),
    },
    dispatches: [...open, ...(lastClosed ? [lastClosed] : [])].map(copy),
  };
}

async function acknowledge(id) {
  await delay();
  takeFailure();
  return transition(id, 'ASSIGNED', 'ACKNOWLEDGED');
}

async function markOnSite(id) {
  await delay();
  takeFailure();
  return transition(id, 'ACKNOWLEDGED', 'ON_SITE', (dispatch) => {
    team.status = 'ON_SITE';
    team.currentLocation = { ...dispatch.incidentLocation };
  });
}

async function complete(id) {
  await delay();
  takeFailure();
  return transition(id, 'ON_SITE', 'COMPLETED', () => {
    team.status = 'AVAILABLE';
  });
}

/**
 * Demo and test hooks, not part of the API: `failNext('network')` makes the
 * next call fail as if offline, `failNext('server')` as a 500; `assign(fields)`
 * sends the team a new ASSIGNED dispatch with the usual 5 minutes to respond,
 * as the officer's console would.
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
  assign(fields = {}) {
    expireOverdue();
    dispatches.unshift(
      newDispatch({
        label: 'Ja-Ela – blocked bridge',
        lat: 7.0744,
        lng: 79.8919,
        priority: 'CRITICAL',
        secondsToRespond: ACK_TIMEOUT_MINUTES * 60,
        ...fields,
      }),
    );
    team.status = 'DISPATCHED';
  },
};

const dispatchesApi = {
  getMine,
  acknowledge,
  markOnSite,
  complete,
};

export default dispatchesApi;
