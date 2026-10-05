// Mock of ../hazardAlertsApi.js (docs/api-contract.md §12). Resolves with the
// same shapes the real client hands back and rejects with axios-shaped
// errors, so swapping in the real client changes no calling code. It applies
// the server's own rules - the 160-character message, unknown areas (E1),
// DRAFT-only edits - so the screen meets the same errors, counts citizens per
// district from ./areaFixtures.js (each once, even through a basin), and
// generates the server's messages. `mockControls.failNext` fakes the failures
// that can't be typed in.
//
// Alerts live in this module's memory, so reloading the page forgets them.

import { DEMO_USERS } from '../../constants/demoUsers';
import { ROLES } from '../../constants/roles';
import { citizensIn, expandToDistrictIds, findArea } from './areaFixtures';

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const MESSAGE_MAX_LENGTH = 160;

const HAZARD_TYPES = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];
const CHANNELS = ['PUSH', 'SMS', 'AUDIBLE'];

// The same wording as the server's MessageTemplate.
const LABELS = { FLOOD: 'Flood', LANDSLIDE: 'Landslide', CYCLONE: 'Cyclone', DROUGHT: 'Drought' };
const ADVICE = {
  FLOOD: {
    urgent: 'Move to higher ground and follow official guidance.',
    watch: 'Avoid riverbanks and low ground, and be ready to move to higher ground.',
  },
  LANDSLIDE: {
    urgent: 'Leave steep slopes now and move to a safe shelter.',
    watch: 'Watch slopes for cracks or falling rocks, and be ready to leave.',
  },
  CYCLONE: {
    urgent: 'Stay indoors away from windows, or move to the nearest shelter.',
    watch: 'Secure loose objects and keep water, food and a torch ready.',
  },
  DROUGHT: {
    urgent: 'Use water only for essential needs and follow official water guidance.',
    watch: 'Save water where you can and follow official water guidance.',
  },
};

// The signed-in officer isn't known here, so drafts are made by the first
// demo officer, with the id the auth mock gives them.
const officerIndex = DEMO_USERS.findIndex(({ role }) =>
  [ROLES.DUTY_OFFICER, ROLES.DMC_OFFICER].includes(role),
);
const OFFICER = {
  id: `64f1a2b3c4d5e6f7a8b9c0d${officerIndex + 1}`,
  name: DEMO_USERS[officerIndex]?.name ?? 'Demo Officer',
};

const alerts = new Map();
let nextReference = 1043;
let nextId = 1;
let pendingFailure = null;

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiError(status, code, message, errors) {
  const error = new Error(message);
  error.response = {
    status,
    data: {
      success: false,
      error: errors ? { code, message, errors } : { code, message },
    },
  };
  return error;
}

const validationError = (errors) =>
  apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', errors);

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
  if (failure === 'network') throw networkError();
  if (failure === 'server') {
    throw apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
  if (failure === 'validation') {
    throw validationError([
      { field: 'areaIds', message: 'unknown area ids: 66f7c1a2b3c4d5e6f7a8b999' },
    ]);
  }
}

function findAlert(id) {
  const alert = alerts.get(id);
  if (!alert) throw apiError(404, 'NOT_FOUND', 'Hazard alert not found.');
  return alert;
}

function requireDraft(alert, action) {
  if (alert.status !== 'DRAFT') {
    throw apiError(
      409,
      'INVALID_ALERT_TRANSITION',
      `Only a DRAFT alert can be ${action} – current status: ${alert.status}`,
    );
  }
}

const copy = (alert) => JSON.parse(JSON.stringify(alert));

function generateMessage(hazardType, severity) {
  const urgent = severity === 'HIGH' || severity === 'SEVERE';
  return `${LABELS[hazardType]} Warning: ${severity}. ${ADVICE[hazardType][urgent ? 'urgent' : 'watch']}`;
}

async function startDraft() {
  await delay();
  takeFailure();

  const now = new Date().toISOString();
  const alert = {
    id: `66fb2c3d4e5f6a7b8c9d${String(nextId++).padStart(4, '0')}`,
    referenceNo: `HA-${nextReference++}`,
    hazardType: null,
    severity: null,
    message: null,
    status: 'DRAFT',
    version: 1,
    targets: [],
    event: null,
    sourceReport: null,
    createdBy: OFFICER,
    issuedBy: null,
    issuedAt: null,
    statusHistory: [{ status: 'DRAFT', version: 1, at: now, by: OFFICER }],
    createdAt: now,
    updatedAt: now,
  };
  alerts.set(alert.id, alert);
  return { alert: copy(alert) };
}

async function preview(id, { hazardType, severity, areaIds } = {}) {
  await delay();
  takeFailure();
  const alert = findAlert(id);

  const errors = [];
  if (!hazardType) errors.push({ field: 'hazardType', message: 'is required' });
  else if (!HAZARD_TYPES.includes(hazardType)) {
    errors.push({ field: 'hazardType', message: `must be one of [${HAZARD_TYPES.join(', ')}]` });
  }
  if (!severity) errors.push({ field: 'severity', message: 'is required' });
  else if (!SEVERITIES.includes(severity)) {
    errors.push({ field: 'severity', message: `must be one of [${SEVERITIES.join(', ')}]` });
  }
  if (!Array.isArray(areaIds)) errors.push({ field: 'areaIds', message: 'is required' });
  else if (areaIds.length === 0) {
    errors.push({ field: 'areaIds', message: 'must contain at least 1 items' });
  }
  if (errors.length > 0) throw validationError(errors);

  const requested = [...new Set(areaIds)];
  const unknown = requested.filter((areaId) => !findArea(areaId));
  if (unknown.length > 0) {
    throw validationError([
      { field: 'areaIds', message: `unknown area ids: ${unknown.join(', ')}` },
    ]);
  }
  requireDraft(alert, 'previewed');

  const areas = requested.map(findArea);
  const message = generateMessage(hazardType, severity);
  Object.assign(alert, {
    hazardType,
    severity,
    message,
    targets: areas.map(({ kind, area }) => ({ kind, id: area.id, name: area.name })),
    updatedAt: new Date().toISOString(),
  });

  return {
    alert: copy(alert),
    recipientCount: citizensIn(expandToDistrictIds(areas)),
    message,
    channels: CHANNELS.map((channel) => ({ channel, ready: true })),
    activeWarning: null,
  };
}

async function saveDraftMessage(id, message) {
  await delay();
  takeFailure();
  const alert = findAlert(id);

  const text = typeof message === 'string' ? message.trim() : '';
  if (text.length === 0) throw validationError([{ field: 'message', message: 'is required' }]);
  if (text.length > MESSAGE_MAX_LENGTH) {
    throw validationError([
      {
        field: 'message',
        message: `length must be less than or equal to ${MESSAGE_MAX_LENGTH} characters long`,
      },
    ]);
  }
  requireDraft(alert, 'edited');

  alert.message = text;
  alert.updatedAt = new Date().toISOString();
  return { alert: copy(alert) };
}

async function getById(id) {
  await delay();
  takeFailure();
  return { alert: copy(findAlert(id)) };
}

/**
 * Demo and test hooks, not part of the API: `failNext('network')` makes the
 * next call fail as if offline, `failNext('server')` as a 500, and
 * `failNext('validation')` as a 400 on areaIds (E1).
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
};

export default {
  startDraft,
  preview,
  saveDraftMessage,
  getById,
};
