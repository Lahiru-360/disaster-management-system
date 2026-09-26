import axios from 'axios';

import { API_BASE_URL } from '../constants/config';
import secureStorage from '../store/secureStorage';

const BASE_URL = `${API_BASE_URL}/api`;

const client = axios.create({
  baseURL: BASE_URL,
});

client.interceptors.request.use(async (config) => {
  const { accessToken } = await secureStorage.getTokens();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let sessionExpiredHandler = null;

// Lets other modules react when a refresh ultimately fails, without this
// module importing them (client.js must stay leaf-level to avoid an
// import cycle with authApi.js). Nothing subscribes yet.
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

let isRefreshing = false;
let refreshQueue = [];

// Deliberately bypasses `client` (plain axios) so this call never re-enters
// the response interceptor below.
async function refreshTokens(refreshToken) {
  const response = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
  return response.data.data;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Only treat this as an expired-access-token case if the failing
    // request actually carried a bearer token - login/register/refresh
    // calls never do, so a 401 from those is a real auth failure, not an
    // expired session.
    const isExpiredAccessToken =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      Boolean(originalRequest.headers?.Authorization);

    if (!isExpiredAccessToken) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then(() => {
        originalRequest._retry = true;
        return client(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { refreshToken } = await secureStorage.getTokens();
      if (!refreshToken) {
        throw error;
      }

      const tokens = await refreshTokens(refreshToken);
      await secureStorage.setTokens(tokens);

      refreshQueue.forEach(({ resolve }) => resolve());
      refreshQueue = [];

      return await client(originalRequest);
    } catch (refreshError) {
      refreshQueue.forEach(({ reject }) => reject(refreshError));
      refreshQueue = [];

      await secureStorage.clearTokens();
      sessionExpiredHandler?.();

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default client;
