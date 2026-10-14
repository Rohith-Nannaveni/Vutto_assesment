import crypto from 'node:crypto';
import { SESSION_COOKIE, verifyToken } from '../services/authService.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfMatches(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function loadSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifyToken(token, 'session');
  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('INVALID_TOKEN', 'Invalid authentication token.');
  return { user, csrf: payload.csrf };
}

// Requires a valid session. State-changing requests also need the matching CSRF header.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const session = await loadSession(req);
  if (!session) throw unauthorized('AUTH_REQUIRED', 'Please sign in to continue.');
  if (!SAFE_METHODS.has(req.method) && !csrfMatches(session.csrf, req.get('x-csrf-token'))) {
    throw forbidden('CSRF_INVALID', 'Missing or invalid CSRF token.');
  }
  req.user = session.user;
  req.auth = { csrf: session.csrf };
  next();
});

// For public GET routes that personalise output when a user happens to be signed in.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    const session = await loadSession(req);
    if (session) req.user = session.user;
  } catch {
    // An invalid/expired cookie on a public route is treated as signed out.
  }
  next();
});

// Authorization is always checked server-side against the role stored in the database.
export const requireRole = (role) => (req, _res, next) => {
  if (!req.user || req.user.role !== role) return next(forbidden('FORBIDDEN', 'You do not have permission to do that.'));
  next();
};
