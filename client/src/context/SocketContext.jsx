import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { authApi } from '../api/index.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';
import { formatCurrency } from '../utils/format.js';

const SocketContext = createContext({ socket: null, status: 'connecting' });

// Dev: same origin (Vite proxies /socket.io). Production: set VITE_SOCKET_URL to the API origin.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

export function SocketProvider({ children }) {
  const { user, loading } = useAuth();
  const { notify } = useToast();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | connected | reconnecting | offline
  const userId = user?.id ?? null;

  // One connection per signed-in identity. The auth callback runs on every (re)connect attempt,
  // so each handshake carries a fresh 60-second token instead of a long-lived credential.
  useEffect(() => {
    if (loading) return undefined;
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 8000,
      auth: async (cb) => {
        if (!userId) return cb({});
        try { cb({ token: (await authApi.socketToken()).data.token }); } catch { cb({}); }
      },
    });
    setStatus('connecting');
    s.on('connect', () => setStatus('connected'));
    s.on('disconnect', (reason) => setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting'));
    s.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    s.on('connect_error', () => setStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'offline')));
    s.on('auction:outbid', (e) => {
      notify(`You were outbid on "${e.title}". Current bid is ${formatCurrency(e.currentBid)}.`, { type: 'warning' });
    });
    setSocket(s);
    return () => { s.removeAllListeners(); s.close(); setSocket(null); };
  }, [loading, userId, notify]);

  const value = useMemo(() => ({ socket, status }), [socket, status]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
