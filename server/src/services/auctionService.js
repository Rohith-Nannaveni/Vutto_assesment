import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { OPEN_STATUSES, STATUS, EDITABLE_FIELDS, canTransition } from '../utils/auctionRules.js';
import { AppError, notFound } from '../utils/AppError.js';
import { pageMeta } from '../utils/pagination.js';
import { events, EVENTS } from './events.js';
import { logger } from '../utils/logger.js';
import { DURATION_MESSAGE, durationRule } from '../validators/schemas.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { newest: { createdAt: -1 }, priceAsc: { currentBid: 1 }, priceDesc: { currentBid: -1 } };

/** Public listing with search, filters, sorting and server-side pagination. */
export async function listAuctions(query) {
  const { page = 1, limit = 12, q, brand, condition, status, minPrice, maxPrice, sort = 'newest' } = query;
  const filter = {};
  if (q) {
    // Escaped so user input is always a literal substring, never a regex.
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { brand: rx }, { model: rx }];
  }
  if (brand) filter.brand = brand;
  if (condition) filter.condition = condition;
  if (status) filter.status = status;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.currentBid = {};
    if (minPrice !== undefined) filter.currentBid.$gte = minPrice;
    if (maxPrice !== undefined) filter.currentBid.$lte = maxPrice;
  }

  let order = SORTS[sort];
  if (sort === 'endingSoon') {
    // "Ending soon" only makes sense for open auctions unless the caller filtered explicitly.
    if (!status) filter.status = { $in: OPEN_STATUSES };
    order = status === STATUS.ENDED || status === STATUS.CANCELLED ? { endTime: -1 } : { endTime: 1 };
  }

  const [items, total] = await Promise.all([
    Auction.find(filter).sort({ ...order, _id: 1 }).skip((page - 1) * limit).limit(limit),
    Auction.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

export async function listBrands() {
  return (await Auction.distinct('brand')).sort();
}

export async function getAuctionOrThrow(id) {
  const auction = await Auction.findById(id).populate('highestBidder', 'name').populate('seller', 'name').populate('winner', 'name');
  if (!auction) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');
  return auction;
}

export async function listBids(auctionId, { page = 1, limit = 20 }, { adminView = false } = {}) {
  if (!(await Auction.exists({ _id: auctionId }))) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');
  const [items, total] = await Promise.all([
    Bid.find({ auction: auctionId }).sort({ sequence: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('bidder', adminView ? 'name email' : 'name'),
    Bid.countDocuments({ auction: auctionId }),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

export async function listAuctionsForAdmin({ page = 1, limit = 10, q, status }) {
  const filter = {};
  if (status) filter.status = status;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    Auction.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit)
      .populate('seller', 'name').populate('winner', 'name').populate('highestBidder', 'name'),
    Auction.countDocuments(filter),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

export async function createAuction(data, admin) {
  const now = new Date();
  const status = data.startTime <= now ? STATUS.ACTIVE : STATUS.SCHEDULED;
  const auction = await Auction.create({
    ...data, status, currentBid: data.startingPrice, bidCount: 0, seller: admin._id,
  });
  logger.info('auction.created', { auctionId: String(auction._id), adminId: String(admin._id), status });
  return auction;
}

/**
 * Edit rules depend on state: scheduled auctions are fully editable; active auctions only allow
 * descriptive changes (price, increment and timing are locked once bidding may have started);
 * ended and cancelled auctions are immutable. Bid history and winners are never editable here.
 */
export async function updateAuction(id, changes, admin) {
  const current = await Auction.findById(id);
  if (!current) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');

  const allowed = EDITABLE_FIELDS[current.status];
  if (allowed.length === 0) {
    throw new AppError(409, 'AUCTION_LOCKED', `A ${current.status} auction cannot be edited.`);
  }
  const locked = Object.keys(changes).filter((k) => !allowed.includes(k));
  if (locked.length) {
    throw new AppError(409, 'FIELD_LOCKED', `These fields cannot be changed while the auction is ${current.status}: ${locked.join(', ')}.`, { fields: locked });
  }

  const merged = { ...current.toObject(), ...changes };
  if (changes.startTime || changes.endTime) {
    if (!durationRule(merged.startTime, merged.endTime)) throw new AppError(400, 'VALIDATION_ERROR', DURATION_MESSAGE, { fields: { endTime: DURATION_MESSAGE } });
    if (merged.endTime <= new Date()) throw new AppError(400, 'VALIDATION_ERROR', 'End time must be in the future', { fields: { endTime: 'End time must be in the future' } });
  }
  if (merged.minIncrement > merged.startingPrice) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Increment cannot exceed the starting price', { fields: { minIncrement: 'Increment cannot exceed the starting price' } });
  }

  const set = { ...changes };
  if (changes.startingPrice !== undefined) set.currentBid = changes.startingPrice; // no bids exist while scheduled

  // Conditional on status + bidCount: if a bid or lifecycle change landed meanwhile, the edit is refused.
  const updated = await Auction.findOneAndUpdate(
    { _id: id, status: current.status, bidCount: current.bidCount },
    { $set: set },
    { new: true, runValidators: true },
  );
  if (!updated) throw new AppError(409, 'AUCTION_CHANGED', 'The auction changed while you were editing. Reload and try again.');
  logger.info('auction.updated', { auctionId: String(id), adminId: String(admin._id), fields: Object.keys(changes) });
  return updated;
}

export async function cancelAuction(id, admin, reason) {
  const now = new Date();
  const cancelled = await Auction.findOneAndUpdate(
    { _id: id, status: { $in: OPEN_STATUSES }, endTime: { $gt: now } },
    { $set: { status: STATUS.CANCELLED, cancelledAt: now, cancelledBy: admin._id, cancelReason: reason ?? null } },
    { new: true },
  );
  if (!cancelled) {
    const existing = await Auction.findById(id).lean();
    if (!existing) throw notFound('AUCTION_NOT_FOUND', 'Auction not found.');
    const reasonText = canTransition(existing.status, STATUS.CANCELLED)
      ? 'The auction has already reached its end time and is being finalized.'
      : `A ${existing.status} auction cannot be cancelled.`;
    throw new AppError(409, 'INVALID_TRANSITION', reasonText);
  }
  logger.info('auction.cancelled', { auctionId: String(id), adminId: String(admin._id), bids: cancelled.bidCount });
  events.emit(EVENTS.STATUS_CHANGED, { auction: cancelled });
  return cancelled;
}

export async function getDashboard() {
  const [total, active, scheduled, ended, cancelled, totalBids, recentBids] = await Promise.all([
    Auction.countDocuments({}),
    Auction.countDocuments({ status: STATUS.ACTIVE }),
    Auction.countDocuments({ status: STATUS.SCHEDULED }),
    Auction.countDocuments({ status: STATUS.ENDED }),
    Auction.countDocuments({ status: STATUS.CANCELLED }),
    Bid.countDocuments({}),
    Bid.find({}).sort({ createdAt: -1 }).limit(8).populate('bidder', 'name').populate('auction', 'title status'),
  ]);
  return { totals: { total, active, scheduled, ended, cancelled, totalBids }, recentBids };
}
