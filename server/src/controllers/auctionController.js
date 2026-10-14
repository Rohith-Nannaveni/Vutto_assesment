import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeAuction, serializeBid } from '../utils/serialize.js';
import * as auctions from '../services/auctionService.js';
import { placeBid } from '../services/bidService.js';
import { syncLifecycle } from '../services/lifecycleService.js';

export const list = asyncHandler(async (req, res) => {
  await syncLifecycle();
  const { items, meta } = await auctions.listAuctions(req.validQuery);
  const now = new Date();
  res.json({ success: true, data: items.map((a) => serializeAuction(a, { viewerId: req.user?._id, now })), meta });
});

export const filters = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { brands: await auctions.listBrands() } });
});

export const detail = asyncHandler(async (req, res) => {
  await syncLifecycle();
  const auction = await auctions.getAuctionOrThrow(req.params.id);
  res.json({ success: true, data: serializeAuction(auction, { viewerId: req.user?._id }) });
});

export const bids = asyncHandler(async (req, res) => {
  const { items, meta } = await auctions.listBids(req.params.id, req.validQuery);
  res.json({ success: true, data: items.map(serializeBid), meta });
});

export const createBid = asyncHandler(async (req, res) => {
  const { auction, bid, bidderCount } = await placeBid({
    auctionId: req.params.id, userId: req.user._id, amount: req.body.amount, source: 'rest', requestId: req.id,
  });
  res.status(201).json({
    success: true,
    data: {
      bid: serializeBid({ ...bid.toObject(), bidder: req.user }),
      auction: serializeAuction(auction, { viewerId: req.user._id }),
      bidderCount,
    },
  });
});
