// Real in-app inbox client (docs/api-contract.md §11). Same signatures as
// ./mock/notificationsApi.js so index.js can swap between them. Errors
// propagate as-is: axios rejections already carry `error.response.data.error`.

import client from './client';

// One page of the signed-in user's inbox, newest first, with the unread count
// across the whole inbox: { notifications, page, limit, total, unreadCount }.
async function listMine({ page = 1, limit = 20 } = {}) {
  const response = await client.get('/notifications/me', { params: { page, limit } });
  return response.data.data;
}

// Marks one of the user's items read; resolves with { notification }.
async function markRead(id) {
  const response = await client.patch(`/notifications/${id}/read`);
  return response.data.data;
}

const notificationsApi = {
  listMine,
  markRead,
};

export default notificationsApi;
