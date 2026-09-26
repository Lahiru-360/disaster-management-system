// Resolves each API module to its mock or real implementation based on
// USE_MOCK. Switching implementations is done entirely via the
// VITE_USE_MOCK env var - no code here needs to change.

import { USE_MOCK } from '../constants/config';
import authApiMock from './mock/authApi';
import authApiReal from './authApi';

export const authApi = USE_MOCK ? authApiMock : authApiReal;
