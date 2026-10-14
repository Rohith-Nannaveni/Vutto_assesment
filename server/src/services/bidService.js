import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { AppError, notFound } from '../utils/AppError.js';
import { OPEN_STATUSES, STATUS, minimumNextBid } from '../utils/auctionRules.js';
import { events, EVENTS } from './events.js';
import { logger } from '../utils/logger.js';

const MAX_ATTEMPTS = 10; // a retry only happens when another bid was accepted in between

const isDuplicateKey = (err) => err?.code === 11000;

/**
 * Pure rule check against a snapshot of the auction. Throws AppError on any violation.
 * The snapshot may be stale by the time we write, which is why acceptance is arbitrated by the
 * unique (auction, sequence) index below rather than by this check alone.
 */
export function assertBidAllowed(auction, userId, amount, now) {
  if (auction.status === STATUS.CANCELLED) {
    throw new AppError(409, 'AUCTION_CANCELLED', 'This auction has been cancelled.');
  }
  if (auction.status === STATUS.ENDED || now >= auction.endTime) {
    throw new AppError(409, 'AUCTION_ENDED', 'This auction has ended.');
  }
  if (now < auction.startTime) {
    throw new AppError(409, 'AUCTION_NOT_STARTED', 'This auction has not started yet.');
  }
  if (String(auction.seller) === String(userId)) {
    throw new AppError(403, 'OWN_LISTING', 'You cannot bid on your own listing.');
  }
  if (auction.highestBidder && String(auction.highestBidder) === String(userId)) {
    throw new AppError(409, 'ALREADY_HIGHEST', 'You are already the highest bidder.');
  }
  const minimum = minimumNextBid(auction);
  if (amount < minimum) {
    throw new AppError(422, 'BID_TOO_LOW', `Your bid must be at least ${minimum}.`, { minimumNextBid: minimum });
  }
}

/**
 * Copies one accepted bid onto the auction summary (currentBid / highestBidder / bidCount).
 *  - Only the bid at sequence = bidCount + 1 can be applied, so the summary can never skip or regress.
 *  - It uses absolute $set values (no $inc), so applying the same bid twice is harmless. That lets the
 *    bidder who owns the bid AND any recovering request apply it without coordination.
 *  - It re-checks the server-time window and status, so an auction that was cancelled or expired
 *    in between is not modified.
 * Returns the updated auction, or null if the bid could not be applied.
 */
async function applyBid(bid) {
  const now = new Date();
  return Auction.findOneAndUpdate(
    {
      _id: bid.auction,
      bidCount: bid.sequence - 1,
      status: { $in: OPEN_STATUSES },
      startTime: { $lte: now },
      endTime: { $gt: now },
    },
    { $set: { bidCount: bid.sequence, currentBid: bid.amount, highestBidder: bid.bidder, status: STATUS.ACTIVE } },
    { new: true },
  );
}

// Completes a bid that was inserted but not yet reflected on the auction (a competing request is
// mid-flight, or a process died between the two writes). Safe to call at any time.
async function applyPendingBid(auctionId) {
  const auction = await Auction.findById(auctionId).select('bidCount').lean();
  if (!auction) return;
  const pending = await Bid.findOne({ auction: auctionId, sequence: auction.bidCount + 1 });
  if (pending) await applyBid(pending);
}

/**
 * The single entry point for placing a bid (used by REST and Socket.IO).
 *
 * Concurrency strategy: optimistic concurrency with a unique index as the arbiter.
 *   1. Read the auction and validate the bid against that snapshot (server time, price, ownership).
 *   2. Claim position `bidCount + 1` by inserting the Bid. Bid has a UNIQUE index on (auction, sequence),
 *      which MongoDB enforces atomically, so when several requests race against the same snapshot
 *      exactly one insert succeeds and the others get a duplicate-key error.
 *   3. A loser helps apply the winner's bid to the auction (idempotent), then re-reads and
 *      re-validates against the fresh state. It may now be too low (rejected) or still high enough
 *      (accepted as the next bid). Retries are bounded.
 *   4. The winner applies its bid to the auction summary. If that is no longer possible (cancelled or
 *      expired in the meantime) the never-applied bid is removed and the request is rejected.
 *   5. Events are emitted only after both writes succeeded.
 * No multi-document transaction is needed, so it works on a standalone MongoDB and on Atlas, and
 * correctness does not depend on the atomicity of conditional updates.
 */
export async function placeBid({ auctionId, userId, amount, source = 'rest', requestId }) {
  if (!mongoose.isValidObjectId(auctionId)) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const now = new Date();
    const snapshot = await Auction.findById(auctionId).lean();
    if (!snapshot) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');

    try {
      assertBidAllowed(snapshot, userId, amount, now);
    } catch (err) {
      logger.info('bid.rejected', { auctionId, userId: String(userId), code: err.code, source, requestId });
      throw err;
    }

    let bid;
    try {
      bid = await Bid.create({ auction: auctionId, bidder: userId, amount, sequence: snapshot.bidCount + 1, source });
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      logger.debug('bid.contention', { auctionId, attempt });
      await applyPendingBid(auctionId);
      continue; // lost the race for this position; re-evaluate against fresh state
    }

    let updated = await applyBid(bid);
    if (!updated) {
      const fresh = await Auction.findById(auctionId);
      if (fresh && fresh.bidCount >= bid.sequence && String(fresh.highestBidder) === String(userId)) {
        updated = fresh; // a recovering request already applied our bid
      } else {
        // Could not be applied (cancelled/expired meanwhile). It was never accepted, so remove it.
        await Bid.deleteOne({ _id: bid._id });
        const reason = fresh ? tryReason(fresh, userId, amount) : null;
        logger.info('bid.rejected', { auctionId, userId: String(userId), code: reason?.code ?? 'BID_CONFLICT', source, requestId });
        throw reason ?? new AppError(409, 'BID_CONFLICT', 'The auction changed while placing your bid. Please try again.');
      }
    }
    updated = await updated.populate('highestBidder', 'name');

    logger.info('bid.accepted', {
      auctionId, bidId: String(bid._id), userId: String(userId), amount, sequence: bid.sequence, source, requestId,
    });
    const bidderCount = (await Bid.distinct('bidder', { auction: auctionId })).length;
    events.emit(EVENTS.BID_ACCEPTED, {
      auction: updated,
      bid,
      bidderName: updated.highestBidder?.name,
      bidderCount,
      previousBidderId: snapshot.highestBidder ? String(snapshot.highestBidder) : null,
    });
    return { auction: updated, bid, bidderCount };
  }

  throw new AppError(409, 'BID_CONFLICT', 'Auction is receiving many bids right now. Please try again.');
}

function tryReason(auction, userId, amount) {
  try {
    assertBidAllowed(auction.toObject(), userId, amount, new Date());
    return null;
  } catch (err) {
    return err;
  }
}
