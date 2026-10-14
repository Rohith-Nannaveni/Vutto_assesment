import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeAuction } from '../utils/serialize.js';
import { classifyMyAuctions, listMyBids } from '../services/activityService.js';
import { syncLifecycle } from '../services/lifecycleService.js';

export const myBids = asyncHandler(async (req, res) => {
  await syncLifecycle();
  const { items, meta } = await listMyBids(req.user._id, req.validQuery);
  const data = items.map((b) => ({
    id: String(b.id),
    amount: b.amount,
    createdAt: b.createdAt,
    auction: b.auction && {
      id: String(b.auction._id),
      title: b.auction.title,
      image: b.auction.images?.[0] ?? null,
      status: b.auction.status,
      currentBid: b.auction.currentBid,
      endTime: b.auction.endTime,
      isLeading: String(b.auction.highestBidder) === String(req.user._id),
    },
  }));
  res.json({ success: true, data, meta });
});

export const myAuctions = asyncHandler(async (req, res) => {
  await syncLifecycle();
  const { groups, myBest } = await classifyMyAuctions(req.user._id);
  const out = {};
  const now = new Date();
  for (const [name, list] of Object.entries(groups)) {
    out[name] = list.map((a) => ({
      ...serializeAuction(a, { viewerId: req.user._id, now }),
      myHighestBid: myBest[String(a._id)] ?? null,
    }));
  }
  res.json({ success: true, data: out });
});
