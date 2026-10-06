import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { LOCATION_TIMEOUT_MS } from '../constants/config';

// Why there is no fix: the reporter refused location access, the fix took
// longer than the timeout, or the location service failed.
export const LOCATION_FAILURE = Object.freeze({
  DENIED: 'denied',
  TIMEOUT: 'timeout',
  ERROR: 'error',
});

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { timedOut: true })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// One attempt at a fix: { location } or { failure }.
async function requestFix(timeoutMs) {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { failure: LOCATION_FAILURE.DENIED };
    }
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutMs,
    );
    return {
      location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch (error) {
    return { failure: error?.timedOut ? LOCATION_FAILURE.TIMEOUT : LOCATION_FAILURE.ERROR };
  }
}

/**
 * UC02 step 3 / A2.1: asks the device's location service for the current
 * position once on mount, with a timeout. `status` is 'locating', 'ready'
 * (`location` is { latitude, longitude }) or 'unavailable' (`failure` says
 * why), so the screen can offer manual entry. `retry()` asks again.
 * @param {{ timeoutMs?: number }} [options]
 */
export default function useCurrentLocation({ timeoutMs = LOCATION_TIMEOUT_MS } = {}) {
  const [state, setState] = useState({ status: 'locating', location: null, failure: null });

  const settle = useCallback((result) => {
    setState(
      result.location
        ? { status: 'ready', location: result.location, failure: null }
        : { status: 'unavailable', location: null, failure: result.failure },
    );
  }, []);

  useEffect(() => {
    let current = true;
    requestFix(timeoutMs).then((result) => {
      if (current) settle(result);
    });
    return () => {
      current = false;
    };
  }, [timeoutMs, settle]);

  const retry = useCallback(() => {
    setState({ status: 'locating', location: null, failure: null });
    requestFix(timeoutMs).then(settle);
  }, [timeoutMs, settle]);

  return { ...state, retry };
}
