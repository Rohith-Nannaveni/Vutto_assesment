import { Server } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Auction } from '../models/Auction.js';
import { verifyToken } from '../services/authService.js';
import { placeBid } from '../services/bidService.js';
import { events, EVENTS } from '../services/events.js';
import { AppError, notFound } from '../utils/AppError.js';
import { serializeAuction, serializeBid } from '../utils/serialize.js';
import { objectId } from '../validators/schemas.js';
import { logger } from '../utils/logger.js';

/*
 * Event contract
 *   client -> server (all take an ack callback)
 *     auction:join      { auctionId }            joins the public room; ack returns a fresh snapshot
 *     auction:leave     { auctionId }
 *     auction:placeBid  { auctionId, amount }    authenticated; runs the SAME bidService as REST
 *   server -> client
 *     auction:bidUpdated     (room)      public: new price, masked bidder, counts. Emitted only after DB success
 *     auction:statusChanged  (room)      activated / ended / cancelled
 *     auction:outbid         (user room) private: sent only to the bidder who was just outbid
 *     auction:error          (socket)    rejected join/bid with { code, message }
 * Sockets authenticate with a short-lived token from GET /api/auth/socket-token. Anonymous sockets may
 * join rooms (read-only) but cannot bid.
 */
const joinPayload = z.object({ auctionId: objectId });
const bidPayload = z.object({ auctionId: objectId, amount: z.number().int().positive().max(1_000_000_000) });

const roomOf = (auctionId) => `auction:${auctionId}`;
const userRoom = (userId) => `user:${userId}`;
const noop = () => {};

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    maxHttpBufferSize: 1e4,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // anonymous, read-only
    try {
      const payload = verifyToken(token, 'socket');
      const user = await User.findById(payload.sub).select('name role');
      if (!user) throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
      socket.data.user = user;
      next();
    } catch (err) {
      const error = new Error(err.message);
      error.data = { code: err.code ?? 'INVALID_TOKEN' };
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) socket.join(userRoom(user._id));
    logger.debug('socket.connected', { socketId: socket.id, authenticated: Boolean(user) });
    let recentBids = [];

    // Wraps a handler: validates payload, always acks, never throws into socket.io.
    const handle = (schema, fn) => async (payload, ack = noop) => {
      const reply = typeof ack === 'function' ? ack : noop;
      try {
        const parsed = schema.safeParse(payload);
        if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid payload.');
        reply({ ok: true, ...(await fn(parsed.data)) });
      } catch (err) {
        const known = err instanceof AppError;
        if (!known) logger.error('socket.handler_error', { error: err.message });
        const body = { code: known ? err.code : 'INTERNAL_ERROR', message: known ? err.message : 'Something went wrong.' };
        socket.emit('auction:error', { ...body, auctionId: payload?.auctionId });
        reply({ ok: false, ...body, details: known ? err.details : undefined });
      }
    };

    socket.on('auction:join', handle(joinPayload, async ({ auctionId }) => {
      const auction = await Auction.findById(auctionId).populate('highestBidder', 'name');
      if (!auction) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');
      await socket.join(roomOf(auctionId));
      return { auction: serializeAuction(auction, { viewerId: user?._id }) };
    }));

    socket.on('auction:leave', handle(joinPayload, async ({ auctionId }) => {
      await socket.leave(roomOf(auctionId));
      return {};
    }));

    socket.on('auction:placeBid', handle(bidPayload, async ({ auctionId, amount }) => {
      if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in to place a bid.');
      // Same intent as the REST bid limiter: at most 10 bids per 10 seconds per socket.
      const now = Date.now();
      recentBids = recentBids.filter((t) => now - t < 10_000);
      if (recentBids.length >= 10) throw new AppError(429, 'RATE_LIMITED', 'You are bidding too quickly. Wait a moment.');
      recentBids.push(now);

      const { auction, bid, bidderCount } = await placeBid({ auctionId, userId: user._id, amount, source: 'socket' });
      return {
        bid: serializeBid({ ...bid.toObject(), bidder: user }),
        auction: serializeAuction(auction, { viewerId: user._id }),
        bidderCount,
      };
    }));
  });

  // Broadcasts are driven by service events, which fire only after the database write succeeded.
  const onBid = ({ auction, bid, bidderName, bidderCount, previousBidderId }) => {
    const publicAuction = serializeAuction(auction);
    io.to(roomOf(publicAuction.id)).emit('auction:bidUpdated', {
      auctionId: publicAuction.id,
      currentBid: publicAuction.currentBid,
      minimumNextBid: publicAuction.minimumNextBid,
      bidCount: publicAuction.bidCount,
      bidderCount,
      status: publicAuction.status,
      endTime: publicAuction.endTime,
      bid: serializeBid({ ...bid.toObject(), bidder: { name: bidderName } }),
      serverTime: publicAuction.serverTime,
    });
    if (previousBidderId) {
      io.to(userRoom(previousBidderId)).emit('auction:outbid', {
        auctionId: publicAuction.id,
        title: publicAuction.title,
        currentBid: publicAuction.currentBid,
        minimumNextBid: publicAuction.minimumNextBid,
      });
    }
  };

  const onStatus = ({ auction }) => {
    const a = serializeAuction(auction);
    io.to(roomOf(a.id)).emit('auction:statusChanged', {
      auctionId: a.id, status: a.status, finalPrice: a.finalPrice, hasWinner: a.hasWinner,
      currentBid: a.currentBid, bidCount: a.bidCount, serverTime: a.serverTime,
    });
  };

  events.on(EVENTS.BID_ACCEPTED, onBid);
  events.on(EVENTS.STATUS_CHANGED, onStatus);

  return {
    io,
    close: () =>
      new Promise((resolve) => {
        events.off(EVENTS.BID_ACCEPTED, onBid);
        events.off(EVENTS.STATUS_CHANGED, onStatus);
        io.close(() => resolve()); // also closes the underlying HTTP server
      }),
  };
}
