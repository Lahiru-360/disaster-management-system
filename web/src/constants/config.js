// The portal's display name. Used by the brand mark and the login page.
export const APP_NAME = 'DMC Command Console';

// The only file that reads env vars. Vite exposes only VITE_-prefixed ones to
// the browser bundle, as import.meta.env.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
// True under `npm run dev` only: dev-only pages such as /dev/components exist
// only then, and the production bundle never routes to them.
export const IS_DEV = import.meta.env.DEV;
