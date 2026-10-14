import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeAuctionForAdmin, serializeBid } from '../utils/serialize.js';
import * as auctions from '../services/auctionService.js';
import { processDueAuctions, syncLifecycle } from '../services/lifecycleService.js';

export const dashboard = asyncHandler(async (_req, res) => {
  await syncLifecycle({ force: true });
  const { totals, recentBids } = await auctions.getDashboard();
  res.json({
    success: true,
    data: {
      totals,
      recentActivity: recentBids.map((b) => ({
        id: String(b.id),
        amount: b.amount,
        bidder: b.bidder?.name ?? 'Unknown',
        auctionId: b.auction ? String(b.auction._id) : null,
        auctionTitle: b.auction?.title ?? 'Deleted auction',
        createdAt: b.createdAt,
      })),
    },
  });
});

export const list = asyncHandler(async (req, res) => {
  await syncLifecycle({ force: true });
  const { items, meta } = await auctions.listAuctionsForAdmin(req.validQuery);
  res.json({ success: true, data: items.map((a) => serializeAuctionForAdmin(a)), meta });
});

export const detail = asyncHandler(async (req, res) => {
  await syncLifecycle({ force: true });
  const auction = await auctions.getAuctionOrThrow(req.params.id);
  res.json({ success: true, data: serializeAuctionForAdmin(auction) });
});

// Admins see full bidder name and email for audit purposes; this is never exposed on public routes.
export const bids = asyncHandler(async (req, res) => {
  const { items, meta } = await auctions.listBids(req.params.id, req.validQuery, { adminView: true });
  res.json({
    success: true,
    data: items.map((b) => ({ ...serializeBid(b), bidderName: b.bidder?.name, bidderEmail: b.bidder?.email })),
    meta,
  });
});

export const create = asyncHandler(async (req, res) => {
  const auction = await auctions.createAuction(req.body, req.user);
  res.status(201).json({ success: true, data: serializeAuctionForAdmin(auction) });
});

export const update = asyncHandler(async (req, res) => {
  const auction = await auctions.updateAuction(req.params.id, req.body, req.user);
  res.json({ success: true, data: serializeAuctionForAdmin(auction) });
});

export const cancel = asyncHandler(async (req, res) => {
  const auction = await auctions.cancelAuction(req.params.id, req.user, req.body.reason);
  res.json({ success: true, data: serializeAuctionForAdmin(auction) });
});

// Manual trigger for the same idempotent processing the scheduler runs.
export const runLifecycle = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await processDueAuctions() });
});
