import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { app, startDb, stopDb, resetDb, createUser, createAuction, loginAs, Bid, Auction } from './helpers/setup.js';
import { initSockets } from '../src/sockets/index.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const next = (socket, event, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (p) => { clearTimeout(t); resolve(p); });
  });
const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

describe('socket.io real-time bidding', () => {
  let server; let sockets; let url; let admin; let alice; let bob; let aliceS; let bobS; const open = [];

  const client = async (session) => {
    const auth = session ? { token: (await session.get('/api/auth/socket-token')).body.data.token } : {};
    const s = connect(url, { auth, transports: ['websocket'], forceNew: true, reconnection: false });
    open.push(s);
    await new Promise((resolve, reject) => { s.once('connect', resolve); s.once('connect_error', reject); });
    return s;
  };

  before(async () => {
    await startDb();
    server = http.createServer(app);
    sockets = initSockets(server);
    await new Promise((r) => server.listen(0, r));
    url = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => { await sockets.close(); await stopDb(); });
  beforeEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await resetDb();
    admin = await createUser('admin');
    alice = await createUser('buyer', 'Alice Kumar');
    bob = await createUser('buyer', 'Bob Singh');
    aliceS = await loginAs(alice);
    bobS = await loginAs(bob);
  });

  test('rejects an invalid socket token at connection time', async () => {
    const s = connect(url, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false, forceNew: true });
    open.push(s);
    const err = await new Promise((resolve) => s.once('connect_error', resolve));
    assert.equal(err.data.code, 'INVALID_TOKEN');
  });

  test('a session token cannot be reused as a socket token', async () => {
    const s = connect(url, { auth: { token: aliceS.cookie.split('=')[1] }, transports: ['websocket'], reconnection: false, forceNew: true });
    open.push(s);
    const err = await new Promise((resolve) => s.once('connect_error', resolve));
    assert.equal(err.data.code, 'INVALID_TOKEN');
  });

  test('join returns a snapshot; invalid payloads and unknown auctions get an error ack', async () => {
    const a = await createAuction(admin);
    const s = await client(null);
    const ok = await emitAck(s, 'auction:join', { auctionId: String(a._id) });
    assert.equal(ok.ok, true);
    assert.equal(ok.auction.id, String(a._id));
    assert.equal((await emitAck(s, 'auction:join', { auctionId: 'bad' })).code, 'VALIDATION_ERROR');
    assert.equal((await emitAck(s, 'auction:join', { auctionId: '507f1f77bcf86cd799439011' })).code, 'AUCTION_NOT_FOUND');
  });

  test('broadcasts an accepted bid to the room with public data only, and notifies the outbid user privately', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const watcher = await client(null);
    const aliceSock = await client(aliceS);
    const bobSock = await client(bobS);
    const outsider = await client(null); // never joins the room
    for (const s of [watcher, aliceSock, bobSock]) await emitAck(s, 'auction:join', { auctionId: String(a._id) });

    await aliceS.post(`/api/auctions/${a._id}/bids`).send({ amount: 10_000 });
    const outbidPromise = next(aliceSock, 'auction:outbid');
    const bobGets = next(bobSock, 'auction:bidUpdated');
    const watcherGets = next(watcher, 'auction:bidUpdated');
    let outsiderGot = false;
    outsider.on('auction:bidUpdated', () => { outsiderGot = true; });

    const res = await bobS.post(`/api/auctions/${a._id}/bids`).send({ amount: 11_000 });
    assert.equal(res.status, 201);

    const update = await watcherGets;
    await bobGets;
    assert.equal(update.currentBid, 11_000);
    assert.equal(update.minimumNextBid, 11_500);
    assert.equal(update.bidderCount, 2);
    assert.equal(update.bid.bidder, 'B••• S.');
    const raw = JSON.stringify(update);
    assert.equal(raw.includes('@example.com'), false);
    assert.equal(raw.includes(String(bob._id)), false);

    const outbid = await outbidPromise;
    assert.equal(outbid.auctionId, String(a._id));
    assert.equal(outbid.currentBid, 11_000);
    await wait(150);
    assert.equal(outsiderGot, false);
  });

  test('socket bids use the same rules as REST: anonymous, too-low and own-listing bids are rejected with no broadcast', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const watcher = await client(null);
    await emitAck(watcher, 'auction:join', { auctionId: String(a._id) });
    let broadcasts = 0;
    watcher.on('auction:bidUpdated', () => { broadcasts += 1; });

    const anonymous = await client(null);
    assert.equal((await emitAck(anonymous, 'auction:placeBid', { auctionId: String(a._id), amount: 20_000 })).code, 'AUTH_REQUIRED');

    const aliceSock = await client(aliceS);
    const errorEvent = next(aliceSock, 'auction:error');
    const low = await emitAck(aliceSock, 'auction:placeBid', { auctionId: String(a._id), amount: 5_000 });
    assert.equal(low.ok, false);
    assert.equal(low.code, 'BID_TOO_LOW');
    assert.equal((await errorEvent).code, 'BID_TOO_LOW');

    const adminSock = await client(await loginAs(admin));
    const own = await createAuction(admin);
    assert.equal((await emitAck(adminSock, 'auction:placeBid', { auctionId: String(own._id), amount: 20_000 })).code, 'OWN_LISTING');

    await wait(150);
    assert.equal(broadcasts, 0);
    assert.equal(await Bid.countDocuments({}), 0);
  });

  test('a valid socket bid is persisted and broadcast exactly once', async () => {
    const a = await createAuction(admin, { startingPrice: 10_000, minIncrement: 500 });
    const watcher = await client(null);
    await emitAck(watcher, 'auction:join', { auctionId: String(a._id) });
    let count = 0;
    watcher.on('auction:bidUpdated', () => { count += 1; });
    const aliceSock = await client(aliceS);
    const ack = await emitAck(aliceSock, 'auction:placeBid', { auctionId: String(a._id), amount: 10_500 });
    assert.equal(ack.ok, true);
    assert.equal(ack.auction.currentBid, 10_500);
    await wait(200);
    assert.equal(count, 1);
    assert.equal(await Bid.countDocuments({ auction: a._id }), 1);
    assert.equal((await Bid.findOne({ auction: a._id })).source, 'socket');
  });

  test('broadcasts status changes when an admin cancels an auction', async () => {
    const a = await createAuction(admin);
    const watcher = await client(null);
    await emitAck(watcher, 'auction:join', { auctionId: String(a._id) });
    const changed = next(watcher, 'auction:statusChanged');
    const adminS = await loginAs(admin);
    await adminS.post(`/api/admin/auctions/${a._id}/cancel`).send({ reason: 'test' });
    assert.equal((await changed).status, 'cancelled');
    assert.equal((await Auction.findById(a._id)).status, 'cancelled');
  });
});
