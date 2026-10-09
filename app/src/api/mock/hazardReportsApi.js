// Mock of ../hazardReportsApi.js (docs/api-contract.md §9.2-9.3). Resolves
// with the same shapes the real client hands back and rejects with
// axios-shaped errors, so swapping in the real client changes no calling
// code. It applies the server's own validation rules, so a bad report gets
// the same 400 field errors; `mockControls.failNext` fakes the failures that
// can't be typed in - a dropped connection or a server-side 400.

import { isInsideSriLanka } from '../../constants/geo';

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

const HAZARD_TYPES = ['RISING_RIVER_FLOOD', 'LANDSLIDE', 'BLOCKED_ROAD', 'OTHER'];
const LOCATION_SOURCES = ['GPS', 'MANUAL'];
const DESCRIPTION_MAX_LENGTH = 200;

const COLOMBO = { id: '66f7c1a2b3c4d5e6f7a8b901', name: 'Colombo' };
const DEMO_REPORTER = { id: '64f1a2b3c4d5e6f7a8b9c0d1', role: 'citizen' };

// Continues after the seeded GR-2470…GR-2481, as the server's counter does.
let nextReference = 2482;
let pendingFailure = null;

// One example so My reports isn't empty on first open.
const reports = [
  {
    id: '66f9a0c1b2c3d4e5f6a7b7f3',
    referenceNo: 'GR-2476',
    hazardType: 'BLOCKED_ROAD',
    description: 'Baseline Road blocked by a fallen tree near the junction',
    photoUrl: 'https://placehold.co/600x400/png?text=GR-2476',
    location: { latitude: 6.9022, longitude: 79.8771 },
    locationSource: 'GPS',
    district: COLOMBO,
    reporter: DEMO_REPORTER,
    status: 'DISMISSED',
    isEscalatable: false,
    clusterId: '66f9a0c1b2c3d4e5f6a7b7f3',
    submittedAt: '2026-10-01T11:20:00.000Z',
    reviewedBy: { id: '64f1a2b3c4d5e6f7a8b9c0d5', name: 'Kasun Silva' },
    reviewedAt: '2026-10-01T11:42:00.000Z',
    dismissalReason: 'DUPLICATE',
    dismissalNote: null,
    clientReportId: null,
  },
];

function delay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomObjectId() {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
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

// What axios rejects with when the request never reaches the server.
function networkError() {
  const error = new Error('Network Error');
  error.code = 'ERR_NETWORK';
  error.request = {};
  return error;
}

function validationError(errors) {
  return apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', errors);
}

// The server's submit rules (§9.2), one entry per invalid top-level field.
function validate({ description, hazardType, location, locationSource, photoUrl } = {}) {
  const errors = [];
  const text = typeof description === 'string' ? description.trim() : '';
  if (!text) {
    errors.push({ field: 'description', message: 'is required' });
  } else if (text.length > DESCRIPTION_MAX_LENGTH) {
    errors.push({ field: 'description', message: 'must be at most 200 characters' });
  }
  if (!hazardType) {
    errors.push({ field: 'hazardType', message: 'is required' });
  } else if (!HAZARD_TYPES.includes(hazardType)) {
    errors.push({ field: 'hazardType', message: `must be one of [${HAZARD_TYPES.join(', ')}]` });
  }
  if (location === undefined) {
    errors.push({ field: 'location', message: 'is required' });
  } else if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    errors.push({ field: 'location', message: 'must have a numeric latitude and longitude' });
  } else if (!isInsideSriLanka(location)) {
    errors.push({ field: 'location', message: 'must be inside Sri Lanka' });
  }
  if (!locationSource) {
    errors.push({ field: 'locationSource', message: 'is required' });
  } else if (!LOCATION_SOURCES.includes(locationSource)) {
    errors.push({
      field: 'locationSource',
      message: `must be one of [${LOCATION_SOURCES.join(', ')}]`,
    });
  }
  if (!photoUrl) {
    errors.push({ field: 'photoUrl', message: 'is required' });
  }
  return errors;
}

// Fakes the next call's failure, then goes back to normal.
function takeFailure() {
  const failure = pendingFailure;
  pendingFailure = null;
  if (failure === 'network') {
    throw networkError();
  }
  if (failure === 'validation') {
    throw validationError([{ field: 'location', message: 'must be inside Sri Lanka' }]);
  }
}

async function submit(report) {
  await delay();
  takeFailure();

  const errors = validate(report);
  if (errors.length > 0) {
    throw validationError(errors);
  }

  const id = randomObjectId();
  const stored = {
    id,
    referenceNo: `GR-${nextReference++}`,
    hazardType: report.hazardType,
    description: report.description.trim(),
    photoUrl: report.photoUrl,
    location: { latitude: report.location.latitude, longitude: report.location.longitude },
    locationSource: report.locationSource,
    district: COLOMBO,
    reporter: DEMO_REPORTER,
    status: 'PENDING',
    isEscalatable: false,
    clusterId: id,
    submittedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    dismissalReason: null,
    dismissalNote: null,
    clientReportId: report.clientReportId ?? null,
  };
  reports.unshift(stored);
  return { ...stored };
}

async function listMine() {
  await delay();
  takeFailure();
  return reports.map((report) => ({ ...report }));
}

/**
 * Demo and test hooks, not part of the API: `failNext('network')` makes the
 * next call fail as if offline (A3), `failNext('validation')` as a server 400
 * (E1).
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
};

export default {
  submit,
  listMine,
};
