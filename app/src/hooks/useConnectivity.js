import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

// Whether a NetInfo state can reach the server. `isInternetReachable` is null
// while NetInfo is still checking, which counts as online - the banner should
// only appear once we know the connection is gone.
export function isOnlineState(state) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * UC02 A3: whether the phone is online, kept up to date as the connection
 * comes and goes. Starts as online until NetInfo answers, so the offline
 * banner never flashes on a working connection.
 * @returns {{ isOnline: boolean }}
 */
export default function useConnectivity() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setIsOnline(isOnlineState(state));
      }),
    [],
  );

  return { isOnline };
}
