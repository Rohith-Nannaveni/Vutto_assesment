import { useSocket } from '../context/SocketContext.jsx';

const COPY = {
  connected: { dot: 'bg-green-500', text: 'Live updates on' },
  connecting: { dot: 'bg-amber-500', text: 'Connecting…' },
  reconnecting: { dot: 'bg-amber-500', text: 'Reconnecting… prices may be out of date' },
  offline: { dot: 'bg-red-500', text: 'Live updates unavailable. Refresh to retry' },
};

export default function ConnectionStatus() {
  const { status } = useSocket();
  const c = COPY[status] ?? COPY.offline;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-muted" role="status">
      <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" />
      {c.text}
    </span>
  );
}
