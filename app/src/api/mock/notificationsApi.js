// Mock of ../notificationsApi.js (docs/api-contract.md §11). Resolves with the
// same shapes the real client hands back and rejects with axios-shaped
// errors, so swapping in the real client changes no calling code.
// `mockControls.failNext` fakes the failures that can't be triggered by
// tapping - a dropped connection or a server error.
//
// One shared inbox for whoever is signed in, in this module's memory, so
// reloading the app resets it. `mockControls.receive` adds an item, to see it
// arrive on the next pull-to-refresh.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const MAX_LIMIT = 50;

let pendingFailure = null;
let nextId = 10;

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

// Newest first: one of each kind a field user receives.
const inbox = [
  {
    id: '66fa1b2c3d4e5f6a7b8c9d04',
    type: 'ASSIGNMENT',
    title: 'New assignment',
    body: 'Rescue at Biyagama, HIGH priority. Respond within 15 minutes.',
    link: '/assignments/66fb3d4e5f6a7b8c9d0e1f01',
    severity: null,
    readAt: null,
    createdAt: minutesAgo(3),
  },
  {
    id: '66fa1b2c3d4e5f6a7b8c9d03',
    type: 'REPORT_CONFIRMED',
    title: 'Report confirmed',
    body: 'Your report GR-2481 was confirmed by the duty officer. Thank you.',
    link: '/my-reports/66f9a0c1b2c3d4e5f6a7b801',
    severity: null,
    readAt: null,
    createdAt: minutesAgo(26),
  },
  {
    id: '66fa1b2c3d4e5f6a7b8c9d02',
    type: 'REPORT_DISMISSED',
    title: 'Report reviewed',
    body: 'Thank you for report GR-2476. After review it was not used for a warning (reason: Duplicate). Please keep reporting what you see.',
    link: '/my-reports/66f9a0c1b2c3d4e5f6a7b7f3',
    severity: null,
    readAt: minutesAgo(60),
    createdAt: minutesAgo(120),
  },
];

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

function validate(page, limit) {
  const errors = [];
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'must be greater than or equal to 1' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.push({ field: 'limit', message: `must be between 1 and ${MAX_LIMIT}` });
  }
  if (errors.length > 0) {
    throw apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', errors);
  }
}

async function listMine({ page = 1, limit = 20 } = {}) {
  await delay();
  takeFailure();
  validate(page, limit);

  const start = (page - 1) * limit;
  return {
    notifications: inbox.slice(start, start + limit).map((item) => ({ ...item })),
    page,
    limit,
    total: inbox.length,
    unreadCount: inbox.filter((item) => item.readAt === null).length,
  };
}

async function markRead(id) {
  await delay();
  takeFailure();

  const item = inbox.find((candidate) => candidate.id === id);
  if (!item) {
    throw apiError(404, 'NOT_FOUND', 'Notification not found.');
  }
  item.readAt ??= new Date().toISOString();
  return { notification: { ...item } };
}

/**
 * Demo and test hooks, not part of the API: `failNext('network')` makes the
 * next call fail as if offline, `failNext('server')` as a 500;
 * `receive(fields)` puts a new unread item at the top of the inbox.
 */
export const mockControls = {
  failNext(kind) {
    pendingFailure = kind;
  },
  receive(fields = {}) {
    inbox.unshift({
      id: `66fa1b2c3d4e5f6a7b8c9e${String(nextId++).padStart(2, '0')}`,
      type: 'REPORT_CONFIRMED',
      title: 'Report confirmed',
      body: 'Your report GR-2482 was confirmed by the duty officer. Thank you.',
      link: '/my-reports/66f9a0c1b2c3d4e5f6a7b802',
      severity: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      ...fields,
    });
  },
};

const notificationsApi = {
  listMine,
  markRead,
};

export default notificationsApi;
