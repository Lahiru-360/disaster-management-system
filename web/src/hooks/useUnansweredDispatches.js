import { useEffect, useRef, useState } from 'react';

import { coordinationApi } from '../api';

const POLL_MS = 15000;

// The two ways a dispatch comes back to the officer for another team: the
// lead turned it down (A3), or never answered before the deadline (E4).
const REASSIGN_STATUSES = ['DECLINED', 'UNRESPONSIVE'];

/**
 * UC03 A3.2 and E4.2: the dispatches the officer should reassign. While
 * `enabled`, asks for the district's DECLINED and UNRESPONSIVE dispatches now
 * and every 15 seconds (§13.7.3) and keeps those the officer created that are
 * new since the dashboard opened - the first answer is only a baseline, so one
 * already dealt with earlier doesn't greet every visit. One that happened while
 * the officer was away is reached from its inbox notification, whose link
 * names it (`focusId`). Reads that fail are skipped and tried again next time.
 *
 * `onNewDispatch` is called when one arrives, so the caller can refresh the
 * dashboard (the team is available again after a decline, unavailable after a
 * timeout).
 * @param {{ enabled: boolean, districtId?: string, userId?: string, focusId?: string|null, onNewDispatch?: () => void }} options
 * @returns {{ unanswered: object[], dismiss: (id: string) => void }}
 */
export default function useUnansweredDispatches({
  enabled,
  districtId,
  userId,
  focusId = null,
  onNewDispatch,
}) {
  const [unanswered, setUnanswered] = useState([]);
  const seen = useRef(new Set());
  const dismissed = useRef(new Set());
  const baselined = useRef(false);
  const onNewDispatchRef = useRef(onNewDispatch);
  const focusIdRef = useRef(focusId);

  // Read at each poll, so changing them doesn't restart the baseline.
  useEffect(() => {
    onNewDispatchRef.current = onNewDispatch;
    focusIdRef.current = focusId;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    seen.current = new Set();
    baselined.current = false;

    const poll = () =>
      coordinationApi.listDispatches({ districtId, status: REASSIGN_STATUSES }).then(
        (dispatches) => {
          if (!current) return;
          const mine = dispatches.filter((d) => !userId || d.createdBy?.id === userId);
          const fresh = mine.filter(
            (d) =>
              !dismissed.current.has(d.id) &&
              ((baselined.current && !seen.current.has(d.id)) || d.id === focusIdRef.current),
          );
          mine.forEach((d) => seen.current.add(d.id));
          const arrived = baselined.current && fresh.some((d) => d.id !== focusIdRef.current);
          baselined.current = true;
          if (fresh.length > 0) {
            setUnanswered((previous) => [
              ...previous,
              ...fresh.filter((d) => !previous.some((p) => p.id === d.id)),
            ]);
          }
          if (arrived) onNewDispatchRef.current?.();
        },
        () => {},
      );

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [enabled, districtId, userId]);

  const dismiss = (id) => {
    dismissed.current.add(id);
    setUnanswered((previous) => previous.filter((d) => d.id !== id));
  };

  return { unanswered, dismiss };
}
