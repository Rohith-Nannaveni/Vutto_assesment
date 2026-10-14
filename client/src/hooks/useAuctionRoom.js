import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

// Joins an auction's room and forwards live events. Re-joins automatically after reconnects and
// asks for a fresh snapshot each time, so a dropped connection can never leave stale state behind.
export function useAuctionRoom(auctionId, handlers) {
  const { socket } = useSocket();
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!socket || !auctionId) return undefined;
    const join = () => socket.emit('auction:join', { auctionId }, (ack) => { if (ack?.ok) ref.current.onSnapshot?.(ack.auction); });
    const onBid = (e) => { if (e.auctionId === auctionId) ref.current.onBidUpdated?.(e); };
    const onStatus = (e) => { if (e.auctionId === auctionId) ref.current.onStatusChanged?.(e); };

    socket.on('connect', join);
    socket.on('auction:bidUpdated', onBid);
    socket.on('auction:statusChanged', onStatus);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      socket.off('auction:bidUpdated', onBid);
      socket.off('auction:statusChanged', onStatus);
      if (socket.connected) socket.emit('auction:leave', { auctionId }, () => {});
    };
  }, [socket, auctionId]);
}
