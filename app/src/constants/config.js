// Replace with the new app's display name. Used by the brand mark and auth copy.
export const APP_NAME = 'Disaster Management System';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== 'false';

// UC02 A2.1: how long to wait for a GPS fix before offering to set the
// location by hand. The design only says "within the timeout"; 10 s is the
// plan's default (DMS-133), long enough for a cold fix outdoors.
export const LOCATION_TIMEOUT_MS = 10000;
