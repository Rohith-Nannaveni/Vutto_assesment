import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` });
}

// Single place that turns any error into the standard response shape. Internals never leak.
export function errorHandler(err, req, res, _next) {
  let status = err.status ?? 500;
  let code = err.code;
  let message = err.message;
  let details = err.details;

  if (err.name === 'CastError') { status = 400; code = 'INVALID_ID'; message = 'Invalid identifier.'; }
  else if (err.code === 11000) { status = 409; code = 'DUPLICATE'; message = 'A record with those details already exists.'; }
  else if (err.type === 'entity.too.large') { status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body is too large.'; }
  else if (err.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'Request body is not valid JSON.'; }
  else if (err.message === 'CORS_ORIGIN_NOT_ALLOWED') { status = 403; code = 'CORS_FORBIDDEN'; message = 'Origin not allowed.'; }
  else if (!err.isOperational) { status = 500; code = 'INTERNAL_ERROR'; message = 'Something went wrong on our side.'; details = undefined; }

  const context = { requestId: req.id, method: req.method, path: req.path, status, code, userId: req.user ? String(req.user._id) : undefined };
  if (status >= 500) logger.error('request.error', { ...context, error: err.message, stack: env.isProduction ? undefined : err.stack });
  else logger.debug('request.rejected', context);

  res.status(status).json({ success: false, code, message, ...(details ? { details } : {}) });
}
