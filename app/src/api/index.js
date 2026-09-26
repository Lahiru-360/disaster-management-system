// Resolves each API module to its mock or real implementation based on
// USE_MOCK. Switching implementations is done entirely via the
// EXPO_PUBLIC_USE_MOCK env var - no code here needs to change.

import { USE_MOCK } from '../constants/config';
import authApiMock from './mock/authApi';
import authApiReal from './authApi';
import uploadApiReal from './uploadApi';

export const authApi = USE_MOCK ? authApiMock : authApiReal;

// No mock adapter exists for the upload endpoint, so it reaches the server
// even when USE_MOCK is set. Add a mock module here if one is needed.
export const uploadApi = uploadApiReal;
