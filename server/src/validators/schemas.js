import { z } from 'zod';
import mongoose from 'mongoose';

const trimmed = (min, max) => z.string().trim().min(min).max(max);
const optionalNumber = (schema) => z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), schema.optional());
const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(80).optional());

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
export const idParams = z.object({ id: objectId });

export const registerBody = z.object({
  name: trimmed(2, 50),
  email: z.string().trim().toLowerCase().email().max(254),
  // bcrypt only uses the first 72 bytes, so cap there.
  password: z.string().min(8, 'Password must be at least 8 characters').max(72)
    .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number'),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72),
});

export const bidBody = z.object({
  amount: z.number({ invalid_type_error: 'Bid amount must be a number' }).int('Bid must be a whole number').positive().max(1_000_000_000),
});

const paging = {
  page: optionalNumber(z.number().int().min(1)),
  limit: optionalNumber(z.number().int().min(1).max(50)),
};

export const auctionListQuery = z.object({
  ...paging,
  q: optionalString,
  brand: optionalString,
  condition: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['excellent', 'good', 'fair', 'needs-work']).optional()),
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['scheduled', 'active', 'ended', 'cancelled']).optional()),
  minPrice: optionalNumber(z.number().int().min(0)),
  maxPrice: optionalNumber(z.number().int().min(0)),
  sort: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['endingSoon', 'newest', 'priceAsc', 'priceDesc']).optional()),
});

export const pagingQuery = z.object(paging);

export const adminListQuery = z.object({
  ...paging,
  q: optionalString,
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['scheduled', 'active', 'ended', 'cancelled']).optional()),
});

// Image URLs: absolute http(s) URLs or site-relative paths. Blocks javascript:/data: schemes.
const imageUrl = z.string().trim().max(500).refine(
  (v) => /^https?:\/\/\S+$/i.test(v) || /^\/(?!\/)\S*$/.test(v),
  'Image must be an http(s) URL or a path starting with /',
);

const auctionFields = {
  title: trimmed(5, 120),
  brand: trimmed(2, 40),
  model: trimmed(1, 60),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
  mileageKm: z.number().int().min(0).max(1_000_000),
  engineCc: z.number().int().min(50).max(3000),
  condition: z.enum(['excellent', 'good', 'fair', 'needs-work']),
  description: trimmed(20, 3000),
  location: trimmed(2, 80),
  images: z.array(imageUrl).min(1, 'Add at least one image').max(8),
  startingPrice: z.number().int().min(1).max(1_000_000_000),
  minIncrement: z.number().int().min(1).max(100_000_000),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
};

const MIN_DURATION_MS = 5 * 60 * 1000;
const MAX_DURATION_MS = 30 * 24 * 3600 * 1000;

export const MIN_DURATION_MINUTES = MIN_DURATION_MS / 60000;
export const durationRule = (start, end) => {
  const d = end.getTime() - start.getTime();
  return d >= MIN_DURATION_MS && d <= MAX_DURATION_MS;
};
export const DURATION_MESSAGE = 'Auction must run for between 5 minutes and 30 days after its start time';

export const createAuctionBody = z.object(auctionFields)
  .refine((v) => v.minIncrement <= v.startingPrice, { path: ['minIncrement'], message: 'Increment cannot exceed the starting price' })
  .refine((v) => durationRule(v.startTime, v.endTime), { path: ['endTime'], message: DURATION_MESSAGE })
  .refine((v) => v.endTime > new Date(), { path: ['endTime'], message: 'End time must be in the future' });

export const updateAuctionBody = z.object(auctionFields).partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const cancelBody = z.object({ reason: z.string().trim().max(300).optional() });
