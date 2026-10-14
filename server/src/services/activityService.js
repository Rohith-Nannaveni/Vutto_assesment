import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { pageMeta } from '../utils/pagination.js';

export async function listMyBids(userId, { page = 1, limit = 10 }) {
  const [items, total] = await Promise.all([
    Bid.find({ bidder: userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('auction', 'title images status currentBid endTime highestBidder'),
    Bid.countDocuments({ bidder: userId }),
  ]);
  return { items, meta: pageMeta(page, limit, total) };
}

// Classifies every auction the user has bid on, derived from persisted bids and auction state.
export async function classifyMyAuctions(userId) {
  const auctionIds = (await Bid.distinct('auction', { bidder: userId })).slice(0, 200);
  if (auctionIds.length === 0) return { groups: { leading: [], outbid: [], won: [], lost: [], cancelled: [] }, myBest: {} };

  const [auctions, myBids] = await Promise.all([
    Auction.find({ _id: { $in: auctionIds } }).sort({ endTime: 1 }),
    Bid.find({ bidder: userId, auction: { $in: auctionIds } }).select('auction amount').lean(),
  ]);
  const myBest = {};
  for (const b of myBids) {
    const key = String(b.auction);
    myBest[key] = Math.max(myBest[key] ?? 0, b.amount);
  }

  const groups = { leading: [], outbid: [], won: [], lost: [], cancelled: [] };
  for (const a of auctions) {
    if (a.status === 'cancelled') groups.cancelled.push(a);
    else if (a.status === 'ended') (String(a.winner) === String(userId) ? groups.won : groups.lost).push(a);
    else (String(a.highestBidder) === String(userId) ? groups.leading : groups.outbid).push(a);
  }
  return { groups, myBest };
}
