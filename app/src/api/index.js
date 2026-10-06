// Resolves each API module to its mock or real implementation based on
// USE_MOCK. Switching implementations is done entirely via the
// EXPO_PUBLIC_USE_MOCK env var - no code here needs to change.

import { USE_MOCK } from '../constants/config';
import areasApiMock from './mock/areasApi';
import areasApiReal from './areasApi';
import authApiMock from './mock/authApi';
import authApiReal from './authApi';
import dispatchesApiMock from './mock/dispatchesApi';
import dispatchesApiReal from './dispatchesApi';
import hazardReportsApiMock from './mock/hazardReportsApi';
import hazardReportsApiReal from './hazardReportsApi';
import notificationsApiMock from './mock/notificationsApi';
import notificationsApiReal from './notificationsApi';
import placesApiMock from './mock/placesApi';
import placesApiReal from './placesApi';
import uploadApiMock from './mock/uploadApi';
import uploadApiReal from './uploadApi';

export const authApi = USE_MOCK ? authApiMock : authApiReal;
export const hazardReportsApi = USE_MOCK ? hazardReportsApiMock : hazardReportsApiReal;
export const dispatchesApi = USE_MOCK ? dispatchesApiMock : dispatchesApiReal;
export const notificationsApi = USE_MOCK ? notificationsApiMock : notificationsApiReal;
export const placesApi = USE_MOCK ? placesApiMock : placesApiReal;
export const areasApi = USE_MOCK ? areasApiMock : areasApiReal;
export const uploadApi = USE_MOCK ? uploadApiMock : uploadApiReal;
