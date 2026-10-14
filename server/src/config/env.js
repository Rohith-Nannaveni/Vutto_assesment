import 'dotenv/config';
import { z } from 'zod';

// All configuration is validated once at startup so misconfiguration fails fast.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.preprocess(
  (value) => value === '' || value == null ? undefined : value,
  z.coerce.number().int().positive().default(4000)
),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(8),
  // Comma-separated list of allowed browser origins.
  CLIENT_URL: z.string().min(1, 'CLIENT_URL is required'),
  // Defaults: "lax" in development, "none" (+Secure) in production. See README for the trade-off.
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  // Used only by `npm run seed`.
  ADMIN_NAME: z.string().default('Marketplace Admin'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  DEMO_USER_PASSWORD: z.string().min(8).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';

export const env = {
  ...raw,
  isProduction,
  isTest: raw.NODE_ENV === 'test',
  clientOrigins: raw.CLIENT_URL.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
  cookieSameSite: raw.COOKIE_SAMESITE ?? (isProduction ? 'none' : 'lax'),
  cookieSecure: isProduction || raw.COOKIE_SAMESITE === 'none',
  jwtExpiresInSeconds: Math.round(raw.JWT_EXPIRES_IN_HOURS * 3600),
};
