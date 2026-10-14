import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { OPEN_STATUSES, STATUS } from '../utils/auctionRules.js';
import { events, EVENTS } from './events.js';
import { logger } from '../utils/logger.js';

const DIVERGENCE_GRACE_MS = 30_000;

/** scheduled -> active once startTime has arrived. Safe to run repeatedly. */
export async function activateDueAuctions(now = new Date()) {
  const due = await Auction.find({ status: STATUS.SCHEDULED, startTime: { $lte: now }, endTime: { $gt: now } })
    .select('_id')
    .lean();
  const activated = [];
  for (const { _id } of due) {
    // Conditional update: if another process/request already activated it, this matches nothing.
    const doc = await Auction.findOneAndUpdate(
      { _id, status: STATUS.SCHEDULED, startTime: { $lte: now } },
      { $set: { status: STATUS.ACTIVE } },
      { new: true },
    );
    if (doc) {
      activated.push(doc);
      logger.info('auction.activated', { auctionId: String(_id) });
      events.emit(EVENTS.STATUS_CHANGED, { auction: doc });
    }
  }
  return activated;
}

// Guards against two overlapping runs in this process (scheduler tick + a lazy sync) both emitting an event.
// Across processes the idempotent absolute $set below keeps the data identical either way.
const finalizing = new Set();

/**
 * Finalize one expired auction. The winner is derived from persisted Bid documents,
 * never from the denormalized auction fields. Idempotent: the filter only matches open auctions and
 * the write sets absolute values, so a repeated run cannot create a second or different winner.
 * Returns the finalized auction, or null if nothing changed.
 */
export async function finalizeAuction(auctionId, now = new Date()) {
  const key = String(auctionId);
  if (finalizing.has(key)) return null;
  finalizing.add(key);
  try {
    return await finalize(auctionId, now);
  } finally {
    finalizing.delete(key);
  }
}

async function finalize(auctionId, now) {
  const auction = await Auction.findOne({
    _id: auctionId,
    status: { $in: OPEN_STATUSES },
    endTime: { $lte: now },
  }).lean();
  if (!auction) return null;

  const storedBids = await Bid.countDocuments({ auction: auctionId });
  // A bid that is mid-flight (Bid inserted, auction not yet updated) makes the counts differ.
  // Wait for the next run rather than finalize on incomplete data, unless it persists (crash recovery).
  const stale = now.getTime() - new Date(auction.endTime).getTime() > DIVERGENCE_GRACE_MS;
  if (storedBids !== auction.bidCount && !stale) {
    logger.warn('auction.finalize_deferred', { auctionId: String(auctionId), storedBids, bidCount: auction.bidCount });
    return null;
  }

  const top = storedBids > 0 ? await Bid.findOne({ auction: auctionId }).sort({ amount: -1, sequence: 1 }).lean() : null;
  const update = top
    ? {
        status: STATUS.ENDED, winner: top.bidder, finalPrice: top.amount, finalizedAt: now,
        highestBidder: top.bidder, currentBid: top.amount, bidCount: storedBids,
      }
    : { status: STATUS.ENDED, winner: null, finalPrice: null, finalizedAt: now };

  const finalized = await Auction.findOneAndUpdate(
    // Pinning bidCount means a bid that slipped in after our read makes this a no-op (retried next run).
    { _id: auctionId, status: { $in: OPEN_STATUSES }, endTime: { $lte: now }, bidCount: auction.bidCount },
    { $set: update },
    { new: true },
  );
  if (!finalized) return null;

  logger.info('auction.finalized', {
    auctionId: String(auctionId),
    winnerId: top ? String(top.bidder) : null,
    finalPrice: top?.amount ?? null,
    bids: storedBids,
  });
  events.emit(EVENTS.STATUS_CHANGED, { auction: finalized });
  return finalized;
}

export async function finalizeExpiredAuctions(now = new Date()) {
  const expired = await Auction.find({ status: { $in: OPEN_STATUSES }, endTime: { $lte: now } }).select('_id').lean();
  const results = [];
  for (const { _id } of expired) {
    const done = await finalizeAuction(_id, now);
    if (done) results.push(done);
  }
  return results;
}

/** Run all due transitions. Called by the scheduler and lazily by read endpoints. */
export async function processDueAuctions(now = new Date()) {
  const finalized = await finalizeExpiredAuctions(now);
  const activated = await activateDueAuctions(now);
  return { activated: activated.length, finalized: finalized.length };
}

// Lazy sync for request handlers: cheap, throttled, never throws into the request.
let lastRun = 0;
export async function syncLifecycle({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastRun < 1000) return;
  lastRun = now;
  try {
    await processDueAuctions(new Date(now));
  } catch (err) {
    logger.error('lifecycle.sync_failed', { error: err.message });
  }
}

let timer = null;
export function startScheduler(intervalMs = 15_000) {
  if (timer) return;
  timer = setInterval(() => syncLifecycle({ force: true }), intervalMs);
  timer.unref();
  logger.info('scheduler.started', { intervalMs });
}
export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
