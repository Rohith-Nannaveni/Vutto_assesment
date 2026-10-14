import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, resetDb, createUser, createAuction, Auction, Bid, minutes } from './helpers/setup.js';
import { activateDueAuctions, finalizeAuction, processDueAuctions } from '../src/services/lifecycleService.js';
import { placeBid } from '../src/services/bidService.js';
import { events, EVENTS } from '../src/services/events.js';

describe('auction lifecycle', () => {
  let admin; let alice; let bob;
  before(startDb);
  after(stopDb);
  beforeEach(async () => {
    await resetDb();
    admin = await createUser('admin');
    alice = await createUser('buyer');
    bob = await createUser('buyer');
  });

  const expire = (id) => Auction.updateOne({ _id: id }, { $set: { startTime: new Date(Date.now() - minutes(120)), endTime: new Date(Date.now() - 1000) } });

  test('activates scheduled auctions when their start time arrives, and only then', async () => {
    const due = await createAuction(admin, { status: 'scheduled', startTime: new Date(Date.now() - 1000), endTime: new Date(Date.now() + minutes(60)) });
    const future = await createAuction(admin, { status: 'scheduled', startTime: new Date(Date.now() + minutes(30)), endTime: new Date(Date.now() + minutes(90)) });
    const activated = await activateDueAuctions();
    assert.equal(activated.length, 1);
    assert.equal((await Auction.findById(due._id)).status, 'active');
    assert.equal((await Auction.findById(future._id)).status, 'scheduled');
    assert.equal((await activateDueAuctions()).length, 0); // idempotent
  });

  test('finalizes an expired auction with the highest persisted bid as winner', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    await placeBid({ auctionId: a._id, userId: alice._id, amount: 10_000 });
    await placeBid({ auctionId: a._id, userId: bob._id, amount: 11_000 });
    await placeBid({ auctionId: a._id, userId: alice._id, amount: 12_000 });
    await expire(a._id);

    const done = await finalizeAuction(a._id);
    assert.equal(done.status, 'ended');
    assert.equal(String(done.winner), String(alice._id));
    assert.equal(done.finalPrice, 12_000);
    assert.ok(done.finalizedAt);
  });

  test('derives the winner from stored bids even if the auction summary fields are wrong', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000 });
    await placeBid({ auctionId: a._id, userId: alice._id, amount: 10_000 });
    await placeBid({ auctionId: a._id, userId: bob._id, amount: 11_000 });
    await Auction.updateOne({ _id: a._id }, { $set: { highestBidder: alice._id, currentBid: 10_000 } }); // corrupt the cache
    await expire(a._id);
    const done = await finalizeAuction(a._id);
    assert.equal(String(done.winner), String(bob._id));
    assert.equal(done.finalPrice, 11_000);
  });

  test('is idempotent: repeated or concurrent runs create exactly one result and one event', async () => {
    const a = await createAuction(admin);
    await placeBid({ auctionId: a._id, userId: alice._id, amount: 10_000 });
    await expire(a._id);
    let emitted = 0;
    const listener = () => { emitted += 1; };
    events.on(EVENTS.STATUS_CHANGED, listener);
    const results = await Promise.all([finalizeAuction(a._id), finalizeAuction(a._id), processDueAuctions(), processDueAuctions()]);
    events.off(EVENTS.STATUS_CHANGED, listener);

    assert.equal(emitted, 1);
    assert.equal(results.slice(0, 2).filter(Boolean).length <= 1, true);
    const final = await Auction.findById(a._id);
    assert.equal(final.status, 'ended');
    assert.equal(String(final.winner), String(alice._id));
    assert.equal(await finalizeAuction(a._id), null);
    assert.equal(await Bid.countDocuments({ auction: a._id }), 1);
  });

  test('ends an auction with no bids and no winner', async () => {
    const a = await createAuction(admin);
    await expire(a._id);
    const done = await finalizeAuction(a._id);
    assert.equal(done.status, 'ended');
    assert.equal(done.winner, null);
    assert.equal(done.finalPrice, null);
  });

  test('does not finalize auctions that are still running or already cancelled', async () => {
    const running = await createAuction(admin);
    const cancelled = await createAuction(admin, { status: 'cancelled', endTime: new Date(Date.now() - 1000) });
    assert.equal(await finalizeAuction(running._id), null);
    assert.equal(await finalizeAuction(cancelled._id), null);
    assert.equal((await Auction.findById(cancelled._id)).status, 'cancelled');
  });

  test('defers finalization while a bid is mid-flight (auction updated, Bid not yet written)', async () => {
    const a = await createAuction(admin);
    await Auction.updateOne({ _id: a._id }, { $set: { bidCount: 1, currentBid: 10_500, highestBidder: alice._id } });
    await expire(a._id);
    assert.equal(await finalizeAuction(a._id), null);
    assert.equal((await Auction.findById(a._id)).status, 'active');
  });
});
