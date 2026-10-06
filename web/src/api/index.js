// Resolves each API module to its mock or real implementation based on
// USE_MOCK. Switching implementations is done entirely via the
// VITE_USE_MOCK env var - no code here needs to change.

import { USE_MOCK } from '../constants/config';
import authApiMock from './mock/authApi';
import authApiReal from './authApi';
import groundReportsApiMock from './mock/groundReportsApi';
import groundReportsApiReal from './groundReportsApi';

export const authApi = USE_MOCK ? authApiMock : authApiReal;
export const groundReportsApi = USE_MOCK ? groundReportsApiMock : groundReportsApiReal;
