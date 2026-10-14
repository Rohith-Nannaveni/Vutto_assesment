import { minimumNextBid } from './auctionRules.js';
import { maskName } from './mask.js';

const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);

// Public view of an auction. Never includes bidder ids, emails or admin-only fields.
export function serializeAuction(a, { viewerId = null, now = new Date() } = {}) {
  const doc = typeof a.toObject === 'function' ? a.toObject() : a;
  const viewer = viewerId ? String(viewerId) : null;
  const highest = idOf(doc.highestBidder);
  const winner = idOf(doc.winner);
  return {
    id: String(doc._id),
    title: doc.title,
    brand: doc.brand,
    model: doc.model,
    year: doc.year,
    mileageKm: doc.mileageKm,
    engineCc: doc.engineCc,
    condition: doc.condition,
    description: doc.description,
    location: doc.location,
    images: doc.images,
    startingPrice: doc.startingPrice,
    minIncrement: doc.minIncrement,
    startTime: doc.startTime,
    endTime: doc.endTime,
    status: doc.status,
    currentBid: doc.currentBid,
    bidCount: doc.bidCount,
    minimumNextBid: minimumNextBid(doc),
    leadingBidder: doc.highestBidder?.name ? maskName(doc.highestBidder.name) : null,
    finalPrice: doc.finalPrice,
    hasWinner: Boolean(winner),
    cancelReason: doc.status === 'cancelled' ? doc.cancelReason : undefined,
    isLeading: Boolean(viewer && highest === viewer && doc.status !== 'ended'),
    isWinner: Boolean(viewer && winner === viewer),
    isOwnListing: Boolean(viewer && idOf(doc.seller) === viewer),
    createdAt: doc.createdAt,
    serverTime: now.toISOString(),
  };
}

// Admin view adds seller and finalization details.
export function serializeAuctionForAdmin(a, opts) {
  const doc = typeof a.toObject === 'function' ? a.toObject() : a;
  return {
    ...serializeAuction(a, opts),
    sellerName: doc.seller?.name ?? null,
    winnerName: doc.winner?.name ?? null,
    finalizedAt: doc.finalizedAt,
    cancelledAt: doc.cancelledAt,
    cancelReason: doc.cancelReason,
  };
}

// Public bid: masked display name only.
export function serializeBid(b) {
  const doc = typeof b.toObject === 'function' ? b.toObject() : b;
  return {
    id: String(doc._id),
    amount: doc.amount,
    sequence: doc.sequence,
    bidder: maskName(doc.bidder?.name),
    createdAt: doc.createdAt,
  };
}

export function serializeUser(u) {
  return { id: String(u._id), name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}
