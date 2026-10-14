// Test harness. Sets env BEFORE the app is imported, and refuses to touch anything that isn't a throwaway test database.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL_TEST ?? 'silent';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGODB_URI = 'mongodb://placeholder.invalid/unused'; // required by env schema; never connected to

import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017';
// One database per test file process, so files can never interfere with each other.
export const TEST_DB_NAME = `bike_auction_test_${process.pid}`;
if (!TEST_DB_NAME.startsWith('bike_auction_test_')) throw new Error('Refusing to run against a non-test database');

const { default: app } = await import('../../src/app.js');
const { connectDb, disconnectDb } = await import('../../src/config/db.js');
const { User } = await import('../../src/models/User.js');
const { Auction } = await import('../../src/models/Auction.js');
const { Bid } = await import('../../src/models/Bid.js');
const { hashPassword } = await import('../../src/services/authService.js');

export { app, mongoose, User, Auction, Bid, jwt };
export const PASSWORD = 'Passw0rd-test';

export async function startDb() {
  await connectDb(TEST_URI, { dbName: TEST_DB_NAME });
}
export async function stopDb() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}
export async function resetDb() {
  await Promise.all([Bid.deleteMany({}), Auction.deleteMany({}), User.deleteMany({})]);
}

let counter = 0;
export async function createUser(role = 'buyer', name) {
  counter += 1;
  return User.create({
    name: name ?? `Test User${counter}`,
    email: `user${counter}-${role}@example.com`,
    passwordHash: await hashPassword(PASSWORD),
    role,
  });
}

const MIN = 60_000;
export async function createAuction(seller, overrides = {}) {
  const now = Date.now();
  const startingPrice = overrides.startingPrice ?? 10_000;
  return Auction.create({
    title: '2020 Test Bike 350', brand: 'TestBrand', model: 'T350', year: 2020, mileageKm: 10_000, engineCc: 350,
    condition: 'good', description: 'A well maintained test motorcycle for automated tests.', location: 'Hyderabad',
    images: ['/images/bikes/ktm-duke-390-1.svg'], minIncrement: 500,
    startTime: new Date(now - 60 * MIN), endTime: new Date(now + 60 * MIN), status: 'active',
    seller: seller._id, currentBid: startingPrice, ...overrides, startingPrice,
  });
}

// Supertest agent that keeps the cookie and automatically sends the CSRF header after login.
export async function loginAs(user) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const csrf = res.body.data.csrfToken;
  const wrap = (method) => (url) => agent[method](url).set('X-CSRF-Token', csrf);
  return {
    user, agent, csrf,
    cookie: res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; '),
    get: (url) => agent.get(url),
    post: wrap('post'),
    patch: wrap('patch'),
  };
}

export const anon = () => request(app);
export const minutes = (n) => n * MIN;
