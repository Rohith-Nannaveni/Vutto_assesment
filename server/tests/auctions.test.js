import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { anon, startDb, stopDb, resetDb, createUser, createAuction, Bid, minutes } from './helpers/setup.js';

describe('auction browsing', () => {
  let admin; let buyer;
  before(async () => {
    await startDb();
    await resetDb();
    admin = await createUser('admin');
    buyer = await createUser('buyer', 'Rahul Sharma');
    const t = Date.now();
    await createAuction(admin, { title: '2019 Royal Enfield Classic 350', brand: 'Royal Enfield', model: 'Classic 350', startingPrice: 90_000, condition: 'good', endTime: new Date(t + minutes(30)) });
    await createAuction(admin, { title: '2018 KTM Duke 390', brand: 'KTM', model: 'Duke 390', startingPrice: 140_000, condition: 'excellent', endTime: new Date(t + minutes(10)) });
    await createAuction(admin, { title: '2021 Honda CB350', brand: 'Honda', model: 'CB350', startingPrice: 170_000, status: 'scheduled', startTime: new Date(t + minutes(60)), endTime: new Date(t + minutes(600)) });
    await createAuction(admin, { title: '2017 Old Ducati', brand: 'Ducati', model: 'Monster', startingPrice: 500_000, status: 'ended', startTime: new Date(t - minutes(600)), endTime: new Date(t - minutes(120)) });
  });
  after(stopDb);

  test('lists auctions publicly with pagination metadata', async () => {
    const res = await anon().get('/api/auctions?limit=3');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
    assert.deepEqual(res.body.meta, { page: 1, limit: 3, total: 4, totalPages: 2 });
    assert.ok(res.body.data[0].minimumNextBid);
    assert.equal('seller' in res.body.data[0], false);
  });

  test('searches by title, brand or model and treats regex characters literally', async () => {
    assert.equal((await anon().get('/api/auctions?q=duke')).body.data.length, 1);
    assert.equal((await anon().get('/api/auctions?q=royal')).body.data[0].brand, 'Royal Enfield');
    assert.equal((await anon().get('/api/auctions?q=CB350')).body.data.length, 1);
    const weird = await anon().get('/api/auctions?q=' + encodeURIComponent('.*(['));
    assert.equal(weird.status, 200);
    assert.equal(weird.body.data.length, 0);
  });

  test('filters by status, brand, condition and price range', async () => {
    assert.equal((await anon().get('/api/auctions?status=scheduled')).body.data.length, 1);
    assert.equal((await anon().get('/api/auctions?brand=KTM')).body.data.length, 1);
    assert.equal((await anon().get('/api/auctions?condition=excellent')).body.data.length, 1);
    const range = await anon().get('/api/auctions?minPrice=100000&maxPrice=200000');
    assert.deepEqual(range.body.data.map((a) => a.brand).sort(), ['Honda', 'KTM']);
  });

  test('sorts by ending soon (open auctions only), newest and price', async () => {
    const ending = await anon().get('/api/auctions?sort=endingSoon');
    assert.deepEqual(ending.body.data.slice(0, 2).map((a) => a.brand), ['KTM', 'Royal Enfield']);
    assert.equal(ending.body.data.some((a) => a.status === 'ended'), false);
    const price = await anon().get('/api/auctions?sort=priceDesc');
    assert.equal(price.body.data[0].brand, 'Ducati');
    assert.equal((await anon().get('/api/auctions?sort=priceAsc')).body.data[0].brand, 'Royal Enfield');
  });

  test('rejects invalid query parameters', async () => {
    assert.equal((await anon().get('/api/auctions?limit=500')).status, 400);
    assert.equal((await anon().get('/api/auctions?status=bogus')).status, 400);
  });

  test('returns auction detail, 404 for unknown ids and 400 for malformed ids', async () => {
    const list = await anon().get('/api/auctions?q=duke');
    const id = list.body.data[0].id;
    const res = await anon().get(`/api/auctions/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, '2018 KTM Duke 390');
    assert.ok(res.body.data.serverTime);
    assert.equal((await anon().get('/api/auctions/507f1f77bcf86cd799439011')).status, 404);
    assert.equal((await anon().get('/api/auctions/not-an-id')).status, 400);
  });

  test('exposes bid history with masked names only', async () => {
    const list = await anon().get('/api/auctions?q=duke');
    const id = list.body.data[0].id;
    await Bid.create({ auction: id, bidder: buyer._id, amount: 140_000, sequence: 1 });
    const res = await anon().get(`/api/auctions/${id}/bids`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].bidder, 'R••• S.');
    const raw = JSON.stringify(res.body);
    assert.equal(raw.includes(buyer.email), false);
    assert.equal(raw.includes(String(buyer._id)), false);
  });

  test('unknown API routes return the standard error shape', async () => {
    const res = await anon().get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.ok(res.body.code);
  });

  test('health and readiness endpoints report status without leaking configuration', async () => {
    assert.equal((await anon().get('/api/health')).body.status, 'ok');
    const ready = await anon().get('/api/ready');
    assert.equal(ready.status, 200);
    assert.deepEqual(ready.body, { status: 'ready', checks: { database: 'ok' } });
  });
});
