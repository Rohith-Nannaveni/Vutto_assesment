import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, resetDb, createUser, createAuction, loginAs, Auction, minutes } from './helpers/setup.js';
import { placeBid } from '../src/services/bidService.js';

const payload = (over = {}) => ({
  title: '2020 Honda Hornet 160R', brand: 'Honda', model: 'Hornet 160R', year: 2020, mileageKm: 12000, engineCc: 160,
  condition: 'good', description: 'Clean, single-owner Hornet with full service records and new tyres.', location: 'Pune',
  images: ['/images/bikes/ktm-duke-390-1.svg'], startingPrice: 60000, minIncrement: 500,
  startTime: new Date(Date.now() + minutes(60)).toISOString(), endTime: new Date(Date.now() + minutes(600)).toISOString(), ...over,
});

describe('admin operations', () => {
  let admin; let buyer; let adminS; let buyerS;
  before(startDb);
  after(stopDb);
  beforeEach(async () => {
    await resetDb();
    admin = await createUser('admin');
    buyer = await createUser('buyer', 'Meera Das');
    adminS = await loginAs(admin);
    buyerS = await loginAs(buyer);
  });

  test('dashboard totals are derived from database records', async () => {
    const a = await createAuction(admin);
    await createAuction(admin, { status: 'scheduled', startTime: new Date(Date.now() + minutes(60)), endTime: new Date(Date.now() + minutes(120)) });
    await createAuction(admin, { status: 'ended', endTime: new Date(Date.now() - minutes(10)), startTime: new Date(Date.now() - minutes(100)) });
    await placeBid({ auctionId: a._id, userId: buyer._id, amount: 10_000 });
    const res = await adminS.get('/api/admin/dashboard');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.totals, { total: 3, active: 1, scheduled: 1, ended: 1, cancelled: 0, totalBids: 1 });
    assert.equal(res.body.data.recentActivity[0].bidder, 'Meera Das');
  });

  test('creates a scheduled listing and an immediately active listing', async () => {
    const future = await adminS.post('/api/admin/auctions').send(payload());
    assert.equal(future.status, 201);
    assert.equal(future.body.data.status, 'scheduled');
    assert.equal(future.body.data.currentBid, 60000);
    const now = await adminS.post('/api/admin/auctions').send(payload({ startTime: new Date().toISOString() }));
    assert.equal(now.body.data.status, 'active');
  });

  test('validates listings (timing, increment, image URLs)', async () => {
    const start = new Date(Date.now() + minutes(60));
    const bad = await adminS.post('/api/admin/auctions').send(payload({
      endTime: new Date(start.getTime() - minutes(5)).toISOString(), startTime: start.toISOString(),
      minIncrement: 999999, images: ['javascript:alert(1)'], year: 1800,
    }));
    assert.equal(bad.status, 400);
    assert.ok(bad.body.details.fields.endTime);
    assert.ok(bad.body.details.fields.minIncrement);
    assert.ok(bad.body.details.fields['images.0']);
    assert.ok(bad.body.details.fields.year);
  });

  test('edits a scheduled listing freely and resets the displayed price with the starting price', async () => {
    const created = (await adminS.post('/api/admin/auctions').send(payload())).body.data;
    const res = await adminS.patch(`/api/admin/auctions/${created.id}`).send({ startingPrice: 65000, title: '2020 Honda Hornet 160R (ABS)' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.currentBid, 65000);
    assert.equal(res.body.data.title, '2020 Honda Hornet 160R (ABS)');
  });

  test('locks price and timing once the auction is active, but allows descriptive edits', async () => {
    const a = await createAuction(admin);
    const locked = await adminS.patch(`/api/admin/auctions/${a._id}`).send({ startingPrice: 1 });
    assert.equal(locked.status, 409);
    assert.equal(locked.body.code, 'FIELD_LOCKED');
    const ok = await adminS.patch(`/api/admin/auctions/${a._id}`).send({ description: 'Updated description with extra service details added.' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.description.startsWith('Updated'), true);
  });

  test('refuses to edit ended or cancelled auctions, and can never alter bids or winners', async () => {
    const ended = await createAuction(admin, { status: 'ended' });
    const res = await adminS.patch(`/api/admin/auctions/${ended._id}`).send({ description: 'Trying to change an ended auction here.' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'AUCTION_LOCKED');
    const a = await createAuction(admin);
    // Unknown fields (winner, currentBid) are stripped by validation, so the request is empty and refused.
    const sneaky = await adminS.patch(`/api/admin/auctions/${a._id}`).send({ winner: String(buyer._id), currentBid: 1 });
    assert.equal(sneaky.status, 400);
    assert.equal((await Auction.findById(a._id)).winner, null);
  });

  test('cancels active and scheduled auctions, keeps bid history, and refuses a second cancellation', async () => {
    const a = await createAuction(admin);
    await placeBid({ auctionId: a._id, userId: buyer._id, amount: 10_000 });
    const res = await adminS.post(`/api/admin/auctions/${a._id}/cancel`).send({ reason: 'Seller withdrew the bike' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'cancelled');
    assert.equal(res.body.data.bidCount, 1);
    const again = await adminS.post(`/api/admin/auctions/${a._id}/cancel`).send({});
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'INVALID_TRANSITION');
    const bids = await adminS.get(`/api/admin/auctions/${a._id}/bids`);
    assert.equal(bids.body.data.length, 1);
    assert.equal(bids.body.data[0].bidderEmail, buyer.email); // admin-only audit view
    // A buyer can no longer bid.
    const late = await buyerS.post(`/api/auctions/${a._id}/bids`).send({ amount: 20_000 });
    assert.equal(late.body.code, 'AUCTION_CANCELLED');
  });

  test('cannot cancel an ended auction', async () => {
    const a = await createAuction(admin, { status: 'ended' });
    const res = await adminS.post(`/api/admin/auctions/${a._id}/cancel`).send({});
    assert.equal(res.status, 409);
  });

  test('lists auctions for admins with server-side pagination and status filter', async () => {
    for (let i = 0; i < 5; i += 1) await createAuction(admin);
    await createAuction(admin, { status: 'scheduled', startTime: new Date(Date.now() + minutes(60)), endTime: new Date(Date.now() + minutes(120)) });
    const page = await adminS.get('/api/admin/auctions?limit=4&page=2');
    assert.equal(page.body.data.length, 2);
    assert.equal(page.body.meta.total, 6);
    assert.equal((await adminS.get('/api/admin/auctions?status=scheduled')).body.meta.total, 1);
  });

  test('buyers cannot create, edit or cancel through the admin API', async () => {
    const a = await createAuction(admin);
    assert.equal((await buyerS.post('/api/admin/auctions').send(payload())).status, 403);
    assert.equal((await buyerS.patch(`/api/admin/auctions/${a._id}`).send({ description: 'Buyer attempting an edit of a listing.' })).status, 403);
    assert.equal((await buyerS.post(`/api/admin/auctions/${a._id}/cancel`).send({})).status, 403);
    assert.equal((await Auction.findById(a._id)).status, 'active');
  });
});
