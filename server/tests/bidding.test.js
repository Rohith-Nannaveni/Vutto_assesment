import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, resetDb, createUser, createAuction, loginAs, anon, Auction, Bid, minutes } from './helpers/setup.js';
import { placeBid } from '../src/services/bidService.js';

describe('bidding rules (REST)', () => {
  let admin; let alice; let bob; let aliceS; let bobS;
  before(startDb);
  after(stopDb);
  beforeEach(async () => {
    await resetDb();
    admin = await createUser('admin');
    alice = await createUser('buyer', 'Alice Kumar');
    bob = await createUser('buyer', 'Bob Singh');
    aliceS = await loginAs(alice);
    bobS = await loginAs(bob);
  });

  const stateOf = async (id) => ({ auction: await Auction.findById(id).lean(), bids: await Bid.find({ auction: id }).sort({ sequence: 1 }).lean() });

  test('requires authentication to bid', async () => {
    const a = await createAuction(admin);
    const res = await anon().post(`/api/auctions/${a._id}/bids`).send({ amount: 20_000 });
    assert.equal(res.status, 401);
  });

  test('rejects bids on a scheduled auction', async () => {
    const a = await createAuction(admin, { status: 'scheduled', startTime: new Date(Date.now() + minutes(30)), endTime: new Date(Date.now() + minutes(90)) });
    const res = await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 20_000 });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'AUCTION_NOT_STARTED');
    assert.equal((await stateOf(a._id)).bids.length, 0);
  });

  test('rejects bids after the end time even if the stored status is still active', async () => {
    const a = await createAuction(admin, { startTime: new Date(Date.now() - minutes(120)), endTime: new Date(Date.now() - minutes(1)) });
    const res = await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 20_000 });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'AUCTION_ENDED');
    assert.equal((await stateOf(a._id)).bids.length, 0);
  });

  test('rejects bids on ended and cancelled auctions', async () => {
    const ended = await createAuction(admin, { status: 'ended' });
    const cancelled = await createAuction(admin, { status: 'cancelled' });
    assert.equal((await aliceS.post(`/api/auctions/${ended._id}/bids`).send({ amount: 20_000 })).body.code, 'AUCTION_ENDED');
    assert.equal((await aliceS.post(`/api/auctions/${cancelled._id}/bids`).send({ amount: 20_000 })).body.code, 'AUCTION_CANCELLED');
  });

  test('rejects a bid below the starting price / minimum increment and leaves state untouched', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const low = await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 9_999 });
    assert.equal(low.status, 422);
    assert.equal(low.body.code, 'BID_TOO_LOW');
    assert.equal(low.body.details.minimumNextBid, 10_000);

    assert.equal((await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 10_000 })).status, 201);
    const tooClose = await bobS.post(`/api/auctions/${a._id}/bids`).send({ amount: 10_499 });
    assert.equal(tooClose.status, 422);
    assert.equal(tooClose.body.details.minimumNextBid, 10_500);

    const { auction, bids } = await stateOf(a._id);
    assert.equal(auction.currentBid, 10_000);
    assert.equal(auction.bidCount, 1);
    assert.equal(bids.length, 1);
  });

  test('accepts a valid bid, persists it and makes it the authoritative highest bid', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const res = await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 10_500 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.auction.currentBid, 10_500);
    assert.equal(res.body.data.auction.minimumNextBid, 11_000);
    assert.equal(res.body.data.auction.isLeading, true);
    assert.equal(res.body.data.bid.bidder, 'A••• K.');
    assert.equal(res.body.data.bidderCount, 1);

    const { auction, bids } = await stateOf(a._id);
    assert.equal(String(auction.highestBidder), String(alice._id));
    assert.equal(bids.length, 1);
    assert.equal(bids[0].amount, 10_500);
    assert.equal(bids[0].sequence, 1);

    const history = await anon().get(`/api/auctions/${a._id}/bids`);
    assert.equal(history.body.data[0].amount, 10_500);
  });

  test('promotes a scheduled auction whose start time has arrived when the first bid is accepted', async () => {
    const a = await createAuction(admin, { status: 'scheduled', startTime: new Date(Date.now() - 1000), endTime: new Date(Date.now() + minutes(60)) });
    assert.equal((await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 10_000 })).status, 201);
    assert.equal((await stateOf(a._id)).auction.status, 'active');
  });

  test('blocks bidding on your own listing and re-bidding while already highest', async () => {
    const own = await createAuction(alice);
    const r1 = await aliceS.post(`/api/auctions/${own._id}/bids`).send({ amount: 20_000 });
    assert.equal(r1.status, 403);
    assert.equal(r1.body.code, 'OWN_LISTING');

    const a = await createAuction(admin);
    await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 10_000 });
    const r2 = await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 12_000 });
    assert.equal(r2.status, 409);
    assert.equal(r2.body.code, 'ALREADY_HIGHEST');
  });

  test('validates the amount payload', async () => {
    const a = await createAuction(admin);
    for (const amount of ['20000', 10.5, -5, 0, null, undefined]) {
      const res = await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount });
      assert.equal(res.status, 400, `amount ${JSON.stringify(amount)}`);
    }
    assert.equal((await stateOf(a._id)).bids.length, 0);
  });

  test("reports a user's activity: leading, outbid, won and lost", async () => {
    const live = await createAuction(admin);
    const other = await createAuction(admin);
    await aliceS.post(`/api/auctions/${live._id}/bids`).send({ amount: 10_000 });
    await aliceS.post(`/api/auctions/${other._id}/bids`).send({ amount: 10_000 });
    await bobS.post(`/api/auctions/${other._id}/bids`).send({ amount: 11_000 });

    const mine = await aliceS.get('/api/users/me/auctions');
    assert.equal(mine.body.data.leading.length, 1);
    assert.equal(mine.body.data.leading[0].id, String(live._id));
    assert.equal(mine.body.data.outbid.length, 1);
    assert.equal(mine.body.data.outbid[0].myHighestBid, 10_000);

    // Force both to expire and finalize through the real lifecycle path.
    await Auction.updateMany({}, { $set: { endTime: new Date(Date.now() - 1000) } });
    const { processDueAuctions } = await import('../src/services/lifecycleService.js');
    await processDueAuctions();
    const after = await aliceS.get('/api/users/me/auctions');
    assert.equal(after.body.data.won.length, 1);
    assert.equal(after.body.data.lost.length, 1);
    const bids = await aliceS.get('/api/users/me/bids');
    assert.equal(bids.body.meta.total, 2);
  });
});

describe('bidding concurrency', () => {
  let admin;
  before(async () => { await startDb(); });
  after(stopDb);
  beforeEach(async () => { await resetDb(); admin = await createUser('admin'); });

  test('identical simultaneous bids: exactly one is accepted, the rest are rejected', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const bidders = await Promise.all(Array.from({ length: 10 }, () => createUser('buyer')));
    const results = await Promise.allSettled(bidders.map((u) => placeBid({ auctionId: a._id, userId: u._id, amount: 10_500 })));

    const accepted = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 9);
    assert.ok(rejected.every((r) => ['BID_TOO_LOW', 'BID_CONFLICT'].includes(r.reason.code)), rejected.map((r) => r.reason.code).join());

    const bids = await Bid.find({ auction: a._id }).lean();
    const auction = await Auction.findById(a._id).lean();
    assert.equal(bids.length, 1);
    assert.equal(auction.bidCount, 1);
    assert.equal(auction.currentBid, 10_500);
    assert.equal(String(auction.highestBidder), String(bids[0].bidder));
  });

  test('recovers a bid that was inserted but never applied to the auction (simulated crash between writes)', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const alice = await createUser('buyer');
    const bob = await createUser('buyer');
    await Bid.create({ auction: a._id, bidder: alice._id, amount: 10_000, sequence: 1 }); // auction.bidCount still 0

    // Bob's next bid triggers recovery of Alice's pending bid, then is validated against it.
    await assert.rejects(placeBid({ auctionId: a._id, userId: bob._id, amount: 10_200 }), (e) => e.code === 'BID_TOO_LOW' && e.details.minimumNextBid === 10_500);
    const recovered = await Auction.findById(a._id).lean();
    assert.equal(recovered.bidCount, 1);
    assert.equal(recovered.currentBid, 10_000);
    assert.equal(String(recovered.highestBidder), String(alice._id));

    const ok = await placeBid({ auctionId: a._id, userId: bob._id, amount: 10_500 });
    assert.equal(ok.bid.sequence, 2);
  });

  test('competing bids with different amounts always produce a consistent, strictly increasing history', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const bidders = await Promise.all(Array.from({ length: 8 }, () => createUser('buyer')));
    const amounts = bidders.map((_, i) => 10_500 + i * 700);
    const results = await Promise.allSettled(bidders.map((u, i) => placeBid({ auctionId: a._id, userId: u._id, amount: amounts[i] })));

    const bids = await Bid.find({ auction: a._id }).sort({ sequence: 1 }).lean();
    const auction = await Auction.findById(a._id).lean();
    assert.ok(bids.length >= 1);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, bids.length); // accepted == persisted
    bids.forEach((b, i) => {
      assert.equal(b.sequence, i + 1);
      if (i > 0) assert.ok(b.amount >= bids[i - 1].amount + 500, 'each accepted bid beats the previous by the increment');
    });
    assert.equal(auction.bidCount, bids.length);
    assert.equal(auction.currentBid, bids.at(-1).amount);
    assert.equal(auction.currentBid, Math.max(...bids.map((b) => b.amount)));
    assert.equal(String(auction.highestBidder), String(bids.at(-1).bidder));
    // The highest offer can never be beaten by a lower one, so it must be the final price.
    assert.equal(auction.currentBid, Math.max(...amounts));
  });
});
