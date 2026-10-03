// Resolves each API module to its mock or real implementation based on
// USE_MOCK. Switching implementations is done entirely via the
// EXPO_PUBLIC_USE_MOCK env var - no code here needs to change.

import { USE_MOCK } from '../constants/config';
import authApiMock from './mock/authApi';
import authApiReal from './authApi';
import dispatchesApiMock from './mock/dispatchesApi';
import dispatchesApiReal from './dispatchesApi';
import hazardReportsApiMock from './mock/hazardReportsApi';
import hazardReportsApiReal from './hazardReportsApi';
import notificationsApiMock from './mock/notificationsApi';
import notificationsApiReal from './notificationsApi';
import uploadApiReal from './uploadApi';

export const authApi = USE_MOCK ? authApiMock : authApiReal;
export const hazardReportsApi = USE_MOCK ? hazardReportsApiMock : hazardReportsApiReal;
export const dispatchesApi = USE_MOCK ? dispatchesApiMock : dispatchesApiReal;
export const notificationsApi = USE_MOCK ? notificationsApiMock : notificationsApiReal;

// No mock adapter exists for the upload endpoint, so it reaches the server
// even when USE_MOCK is set. Add a mock module here if one is needed.
export const uploadApi = uploadApiReal;
