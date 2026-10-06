// Mock of ../hazardAlertsApi.js (docs/api-contract.md §12). Resolves with the
// same shapes the real client hands back and rejects with axios-shaped
// errors, so swapping in the real client changes no calling code. It applies
// the server's own rules - the 160-character message, unknown areas (E1),
// DRAFT-only edits, broadcasts and discards (A4) - so the screen meets the same errors,
// counts citizens per district from ./areaFixtures.js (each once, even through
// a basin), and generates the server's messages. A broadcast delivers on every
// channel, as the server does with its demo failure rates at 0. Escalating a
// report (A1) reads it from the ground reports mock, so a report confirmed
// there can be escalated here, and anything else is refused as the server does.
// `mockControls.failNext` fakes the failures that can't be typed in.
//
// Alerts and their deliveries live in this module's memory, so reloading the
// page forgets them.

import { DEMO_USERS } from '../../constants/demoUsers';
import { ROLES } from '../../constants/roles';
import { citizensIn, expandToDistrictIds, findArea } from './areaFixtures';
import groundReportsApi from './groundReportsApi';

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const MESSAGE_MAX_LENGTH = 160;

const HAZARD_TYPES = ['FLOOD', 'LANDSLIDE', 'CYCLONE', 'DROUGHT'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'SEVERE'];
const CHANNELS = ['PUSH', 'SMS', 'AUDIBLE'];

// The server's ReportHazardTypeMapper: ground-impact reports suggest no type.
const REPORT_TO_ALERT_TYPE = {
  RISING_RIVER_FLOOD: 'FLOOD',
  LANDSLIDE: 'LANDSLIDE',
  BLOCKED_ROAD: null,
  OTHER: null,
};

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
// Alert id -> how many citizens its broadcast went to.
const recipients = new Map();
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

function validateMessage(message) {
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
  return text;
}

// The server's delivery summary: every delivery of a broadcast ends DELIVERED.
function summaryFor(alert) {
  const count = recipients.get(alert.id) ?? 0;
  const perChannel = CHANNELS.map((channel) => ({
    channel,
    sent: count,
    delivered: count,
    failed: 0,
  }));
  return {
    version: alert.version,
    perChannel,
    totals: { sent: count * CHANNELS.length, delivered: count * CHANNELS.length, failed: 0 },
    fallback: { channel: 'SMS', resent: 0 },
    unreachedCount: 0,
  };
}

function generateMessage(hazardType, severity) {
  const urgent = severity === 'HIGH' || severity === 'SEVERE';
  return `${LABELS[hazardType]} Warning: ${severity}. ${ADVICE[hazardType][urgent ? 'urgent' : 'watch']}`;
}

// A1.2: what a confirmed report suggests. The mock reports are all filed
// under the district their point is in, so that district is the suggestion.
async function prefillFromReport(sourceReportId) {
  if (typeof sourceReportId !== 'string' || sourceReportId.trim() === '') {
    throw validationError([{ field: 'sourceReportId', message: 'must be a report id' }]);
  }
  const { report } = await groundReportsApi.getReport(sourceReportId);
  if (!report.isEscalatable) {
    throw apiError(
      409,
      'REPORT_NOT_ESCALATABLE',
      `Only a confirmed report can be escalated – current status: ${report.status}`,
    );
  }
  return {
    hazardType: REPORT_TO_ALERT_TYPE[report.hazardType] ?? null,
    districtId: report.district.id,
    reportRef: { id: report.id, referenceNo: report.referenceNo },
  };
}

async function startDraft({ sourceReportId } = {}) {
  await delay();
  takeFailure();
  const prefill = sourceReportId === undefined ? null : await prefillFromReport(sourceReportId);

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
    sourceReport: prefill ? prefill.reportRef : null,
    createdBy: OFFICER,
    issuedBy: null,
    issuedAt: null,
    statusHistory: [{ status: 'DRAFT', version: 1, at: now, by: OFFICER }],
    createdAt: now,
    updatedAt: now,
  };
  alerts.set(alert.id, alert);
  return prefill ? { alert: copy(alert), prefill } : { alert: copy(alert) };
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

  const text = validateMessage(message);
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

async function broadcast(id, message) {
  await delay();
  takeFailure();
  const alert = findAlert(id);

  const text = validateMessage(message);
  requireDraft(alert, 'broadcast');
  if (!alert.hazardType || !alert.severity || alert.targets.length === 0) {
    throw apiError(409, 'INVALID_ALERT_TRANSITION', 'Preview the warning before broadcasting it');
  }

  // Counted again, as the server does, in case the preview is stale.
  const areas = alert.targets.map(({ id: areaId }) => findArea(areaId));
  recipients.set(alert.id, citizensIn(expandToDistrictIds(areas)));

  const now = new Date().toISOString();
  Object.assign(alert, {
    message: text,
    status: 'BROADCAST',
    issuedBy: OFFICER,
    issuedAt: now,
    updatedAt: now,
  });
  alert.statusHistory.push({ status: 'BROADCAST', version: alert.version, at: now, by: OFFICER });

  return { alert: copy(alert), summary: summaryFor(alert) };
}

async function getDeliverySummary(id) {
  await delay();
  takeFailure();
  const alert = findAlert(id);
  return { alert: copy(alert), summary: summaryFor(alert) };
}

async function listDrafts() {
  await delay();
  takeFailure();
  const drafts = [...alerts.values()]
    .filter(({ status }) => status === 'DRAFT')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { alerts: drafts.map(copy) };
}

async function discardDraft(id) {
  await delay();
  takeFailure();
  const alert = findAlert(id);
  requireDraft(alert, 'discarded');
  alerts.delete(id);
  return { alert: copy(alert) };
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
  broadcast,
  getDeliverySummary,
  listDrafts,
  discardDraft,
};
