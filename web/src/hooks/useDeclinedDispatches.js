import { useEffect, useRef, useState } from 'react';

import { coordinationApi } from '../api';

const POLL_MS = 15000;

/**
 * UC03 A3.2: the declined dispatches the officer should reassign. While
 * `enabled`, asks for the district's DECLINED dispatches now and every 15
 * seconds (§13.7.3) and keeps those the officer created that are new since the
 * dashboard opened - the first answer is only a baseline, so a decline already
 * dealt with earlier doesn't greet every visit. A decline that happened while
 * the officer was away is reached from its inbox notification, whose link
 * names it (`focusId`). Reads that fail are skipped and tried again next time.
 *
 * `onNewDecline` is called when one arrives, so the caller can refresh the
 * dashboard (the team is available again).
 * @param {{ enabled: boolean, districtId?: string, userId?: string, focusId?: string|null, onNewDecline?: () => void }} options
 * @returns {{ declined: object[], dismiss: (id: string) => void }}
 */
export default function useDeclinedDispatches({
  enabled,
  districtId,
  userId,
  focusId = null,
  onNewDecline,
}) {
  const [declined, setDeclined] = useState([]);
  const seen = useRef(new Set());
  const dismissed = useRef(new Set());
  const baselined = useRef(false);
  const onNewDeclineRef = useRef(onNewDecline);
  const focusIdRef = useRef(focusId);

  // Read at each poll, so changing them doesn't restart the baseline.
  useEffect(() => {
    onNewDeclineRef.current = onNewDecline;
    focusIdRef.current = focusId;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    seen.current = new Set();
    baselined.current = false;

    const poll = () =>
      coordinationApi.listDispatches({ districtId, status: ['DECLINED'] }).then(
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
            setDeclined((previous) => [
              ...previous,
              ...fresh.filter((d) => !previous.some((p) => p.id === d.id)),
            ]);
          }
          if (arrived) onNewDeclineRef.current?.();
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
    setDeclined((previous) => previous.filter((d) => d.id !== id));
  };

  return { declined, dismiss };
}
