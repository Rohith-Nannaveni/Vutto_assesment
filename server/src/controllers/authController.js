import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeUser } from '../utils/serialize.js';
import {
  SESSION_COOKIE, createSession, createSocketToken, registerUser, sessionCookieOptions, verifyCredentials,
} from '../services/authService.js';
import { logger } from '../utils/logger.js';

function startSession(res, user, status = 200) {
  const { token, csrfToken } = createSession(user);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  res.status(status).json({ success: true, data: { user: serializeUser(user), csrfToken } });
}

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  startSession(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const user = await verifyCredentials(req.body);
  logger.info('auth.login', { userId: String(user._id), requestId: req.id });
  startSession(res, user);
});

export const logout = (_req, res) => {
  const { maxAge, ...clearOptions } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, clearOptions);
  res.json({ success: true, data: null });
};

// Also hands the client a fresh CSRF token after a page refresh (the token lives in the JWT).
export const me = (req, res) => {
  res.json({ success: true, data: { user: serializeUser(req.user), csrfToken: req.auth.csrf } });
};

export const socketToken = (req, res) => {
  res.json({ success: true, data: { token: createSocketToken(req.user) } });
};
