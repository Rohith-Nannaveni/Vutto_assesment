import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

// Limits are relaxed under test so suites can exercise endpoints freely.
const scale = env.isTest ? 1000 : 1;
const make = (windowMs, max, code, message, keyGenerator) =>
  rateLimit({
    windowMs,
    limit: max * scale,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => res.status(429).json({ success: false, code, message }),
  });

const ipKey = (req) => ipKeyGenerator(req.ip);
const userOrIpKey = (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip));

export const apiLimiter = make(60_000, 300, 'RATE_LIMITED', 'Too many requests. Please slow down.', ipKey);
export const authLimiter = make(15 * 60_000, 20, 'RATE_LIMITED', 'Too many attempts. Try again in a few minutes.', ipKey);
export const bidLimiter = make(60_000, 30, 'RATE_LIMITED', 'You are bidding too quickly. Wait a moment.', userOrIpKey);
