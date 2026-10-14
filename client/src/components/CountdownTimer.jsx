import { useEffect, useRef } from 'react';
import { useNow } from '../hooks/useNow.js';
import { formatRemaining } from '../utils/format.js';

// Display only. The server decides whether bidding is open; when the clock runs out we just ask
// the parent to refetch (onElapsed) so the authoritative status replaces the local guess.
// offsetMs = serverTime - clientTime, so a wrong device clock doesn't skew the countdown.
export default function CountdownTimer({ startTime, endTime, status, offsetMs = 0, onElapsed, className = '' }) {
  const now = useNow() + offsetMs;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const open = status === 'active' || status === 'scheduled';
  const elapsedTarget = status === 'scheduled' && now < start ? start : end;
  const elapsed = open && now >= elapsedTarget;
  const fired = useRef(null);
  const callback = useRef(onElapsed);
  callback.current = onElapsed; // latest callback without restarting the timer when its identity changes

  useEffect(() => {
    if (!elapsed || fired.current === elapsedTarget) return;
    fired.current = elapsedTarget;
    // Small delay so the server clock has also passed the boundary. Not cancelled on re-render.
    setTimeout(() => callback.current?.(), 1200);
  }, [elapsed, elapsedTarget]);

  let text;
  if (status === 'cancelled') text = 'Cancelled';
  else if (status === 'ended') text = 'Ended';
  else if (status === 'scheduled' && now < start) text = `Starts in ${formatRemaining(start - now)}`;
  else if (now < end) text = `Ends in ${formatRemaining(end - now)}`;
  else text = 'Closing…';

  const urgent = status === 'active' && end - now < 5 * 60 * 1000 && end - now > 0;
  return (
    <span role="timer" className={`${urgent ? 'font-semibold text-accent' : ''} ${className}`}>
      {text}
    </span>
  );
}
