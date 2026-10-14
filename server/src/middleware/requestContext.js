import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

// Assigns a request id (honouring a sane incoming one) and logs one line per finished request.
export function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/api/health') return; // keep health probes out of the logs
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http.request', {
      requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0],
      status: res.statusCode, durationMs: Math.round(ms), userId: req.user ? String(req.user._id) : undefined,
    });
  });
  next();
}
