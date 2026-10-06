// Mock of ../notificationsApi.js (docs/api-contract.md §11). Resolves with the
// same shapes the real client hands back and rejects with axios-shaped
// errors, so swapping in the real client changes no calling code.
// `mockControls.failNext` fakes the failures that can't be triggered by
// clicking - a dropped connection or a server error.
//
// One shared inbox for whoever is signed in, in this module's memory, so
// reloading the page resets it. `mockControls.receive` adds an item, to see
// the bell's count change on the next poll.

const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const MAX_LIMIT = 50;

let pendingFailure = null;
let nextId = 10;

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

// Newest first, one of each kind an officer receives.
const inbox = [
  {
    id: '66fa1b2c3d4e5f6a7b8c9d03',
    type: 'REPORT_SUBMITTED',
    title: 'New ground report',
    body: 'New ground report GR-2481 – Rising river / Flood – Kolonnawa',
    link: '/ground-reports',
    severity: null,
    readAt: null,
    createdAt: minutesAgo(4),
  },
  {
    id: '66fa1b2c3d4e5f6a7b8c9d02',
    type: 'SHELTER_CAPACITY',
    title: 'Shelters near capacity',
    body: 'All shelters in Gampaha are near capacity or full (Gampaha Central College 92%)',
    link: '/shelter-resources',
    severity: null,
    readAt: null,
    createdAt: minutesAgo(38),
  },
  {
    id: '66fa1b2c3d4e5f6a7b8c9d01',
    type: 'SUPPORT_REQUEST',
    title: 'Rescue support requested',
    body: 'Gampaha requests rescue support – Biyagama, HIGH',
    link: '/rescue-teams',
    severity: null,
    readAt: minutesAgo(50),
    createdAt: minutesAgo(95),
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
      type: 'REPORT_SUBMITTED',
      title: 'New ground report',
      body: 'New ground report GR-2482 – Landslide – Kegalle',
      link: '/ground-reports',
      severity: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      ...fields,
    });
  },
};

export default {
  listMine,
  markRead,
};
