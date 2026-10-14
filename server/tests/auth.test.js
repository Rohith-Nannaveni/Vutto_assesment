import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { anon, startDb, stopDb, resetDb, createUser, loginAs, PASSWORD, User, jwt } from './helpers/setup.js';

describe('authentication', () => {
  before(startDb);
  after(stopDb);
  beforeEach(resetDb);

  test('registers a buyer, sets an HTTP-only cookie and never returns the password hash', async () => {
    const res = await anon().post('/api/auth/register').send({ name: 'Asha Rao', email: 'Asha@Example.com', password: PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, 'asha@example.com'); // normalised
    assert.equal(res.body.data.user.role, 'buyer');
    assert.ok(res.body.data.csrfToken);
    assert.equal(JSON.stringify(res.body).includes('passwordHash'), false);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /session=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const stored = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    assert.notEqual(stored.passwordHash, PASSWORD);
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
  });

  test('ignores a self-assigned admin role during registration', async () => {
    const res = await anon().post('/api/auth/register').send({ name: 'Sneaky', email: 's@example.com', password: PASSWORD, role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'buyer');
  });

  test('rejects duplicate emails regardless of case', async () => {
    await anon().post('/api/auth/register').send({ name: 'First', email: 'dup@example.com', password: PASSWORD });
    const res = await anon().post('/api/auth/register').send({ name: 'Second', email: 'DUP@example.com', password: PASSWORD });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'EMAIL_TAKEN');
  });

  test('validates registration input with field-level messages', async () => {
    const res = await anon().post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.ok(res.body.details.fields.name && res.body.details.fields.email && res.body.details.fields.password);
  });

  test('logs in with valid credentials', async () => {
    const user = await createUser();
    const res = await anon().post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, String(user._id));
  });

  test('gives the same error for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrong = await anon().post('/api/auth/login').send({ email: user.email, password: 'Wrong-pass1' });
    const unknown = await anon().post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Wrong-pass1' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');
    assert.equal(wrong.body.message, unknown.body.message);
  });

  test('protects /auth/me and returns the profile with a valid session', async () => {
    assert.equal((await anon().get('/api/auth/me')).status, 401);
    const session = await loginAs(await createUser());
    const res = await session.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.csrfToken, session.csrf);
  });

  test('treats expired and malformed tokens as unauthenticated with distinct codes', async () => {
    const user = await createUser();
    const expired = jwt.sign({ typ: 'session', role: 'buyer', csrf: 'x' }, process.env.JWT_SECRET, { subject: String(user._id), expiresIn: -10 });
    const r1 = await anon().get('/api/auth/me').set('Cookie', `session=${expired}`);
    assert.equal(r1.status, 401);
    assert.equal(r1.body.code, 'TOKEN_EXPIRED');
    const r2 = await anon().get('/api/auth/me').set('Cookie', 'session=garbage');
    assert.equal(r2.body.code, 'INVALID_TOKEN');
    const forged = jwt.sign({ typ: 'session', role: 'admin', csrf: 'x' }, 'a-different-secret-a-different-secret', { subject: String(user._id) });
    const r3 = await anon().get('/api/auth/me').set('Cookie', `session=${forged}`);
    assert.equal(r3.body.code, 'INVALID_TOKEN');
  });

  test('requires the CSRF header on state-changing authenticated requests', async () => {
    const session = await loginAs(await createUser());
    const res = await session.agent.post('/api/auctions/507f1f77bcf86cd799439011/bids').send({ amount: 100 });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'CSRF_INVALID');
  });

  test('logout clears the session cookie', async () => {
    const session = await loginAs(await createUser());
    const res = await session.agent.post('/api/auth/logout');
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /session=;/);
    assert.equal((await session.get('/api/auth/me')).status, 401);
  });

  test('blocks buyers and anonymous users from admin endpoints', async () => {
    const buyer = await loginAs(await createUser());
    assert.equal((await anon().get('/api/admin/dashboard')).status, 401);
    const forbidden = await buyer.get('/api/admin/dashboard');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');
    assert.equal((await buyer.post('/api/admin/auctions').send({})).status, 403);
    assert.equal((await buyer.post('/api/admin/auctions/507f1f77bcf86cd799439011/cancel').send({})).status, 403);
  });
});
