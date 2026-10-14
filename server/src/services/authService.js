import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError, unauthorized } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = 10;
const ALGORITHM = 'HS256';
export const SESSION_COOKIE = 'session';
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export async function registerUser({ name, email, password }) {
  if (await User.exists({ email })) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
  try {
    // Role is never taken from the request: public registration always creates a buyer.
    const user = await User.create({ name, email, passwordHash: await hashPassword(password), role: 'buyer' });
    logger.info('user.registered', { userId: String(user._id) });
    return user;
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    throw err;
  }
}

export async function verifyCredentials({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    logger.warn('auth.login_failed');
    throw unauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  return user;
}

// Session = HTTP-only cookie holding this JWT. The csrf value inside it must be echoed in the
// X-CSRF-Token header on every state-changing request (the client receives it in the login/me response).
export function createSession(user) {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign({ role: user.role, csrf: csrfToken, typ: 'session' }, env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: env.jwtExpiresInSeconds,
    algorithm: ALGORITHM,
  });
  return { token, csrfToken };
}

// Short-lived token used only for the Socket.IO handshake, so sockets never depend on cross-site cookies.
export function createSocketToken(user) {
  return jwt.sign({ typ: 'socket' }, env.JWT_SECRET, { subject: String(user._id), expiresIn: 60, algorithm: ALGORITHM });
}

export function verifyToken(token, expectedType) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
    if (payload.typ !== expectedType) throw unauthorized('INVALID_TOKEN', 'Invalid authentication token.');
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'TokenExpiredError') throw unauthorized('TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
    throw unauthorized('INVALID_TOKEN', 'Invalid authentication token.');
  }
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  maxAge: env.jwtExpiresInSeconds * 1000,
  path: '/',
});
