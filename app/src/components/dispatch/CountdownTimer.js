import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

// "04:32": whole minutes and seconds left, never below 00:00.
export function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// A live countdown to `deadline` (an ISO time), ticking each second. When it
// reaches zero `onExpire` is called once, so the caller can ask the server
// where the assignment stands - the server, not this clock, decides that it
// has expired. Presentational: the text's style comes in as className.
export default function CountdownTimer({ deadline, onExpire, className }) {
  const target = new Date(deadline).getTime();
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    expired.current = false;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() >= target && !expired.current) {
        expired.current = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={`${formatCountdown(target - now)} left to respond`}
      className={className}
    >
      {formatCountdown(target - now)}
    </Text>
  );
}
