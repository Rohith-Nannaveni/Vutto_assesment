import { Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, bidLimiter } from '../middleware/rateLimit.js';
import * as s from '../validators/schemas.js';
import * as authC from '../controllers/authController.js';
import * as auctionC from '../controllers/auctionController.js';
import * as userC from '../controllers/userController.js';
import * as adminC from '../controllers/adminController.js';
import * as healthC from '../controllers/healthController.js';

const router = Router();

// Operations
router.get('/health', healthC.health);
router.get('/ready', healthC.ready);

// Authentication
router.post('/auth/register', authLimiter, validate({ body: s.registerBody }), authC.register);
router.post('/auth/login', authLimiter, validate({ body: s.loginBody }), authC.login);
router.post('/auth/logout', authC.logout);
router.get('/auth/me', authenticate, authC.me);
router.get('/auth/socket-token', authenticate, authC.socketToken);

// Public auctions (session optional so responses can include isLeading / isOwnListing)
router.get('/auctions', optionalAuth, validate({ query: s.auctionListQuery }), auctionC.list);
router.get('/auctions/filters', auctionC.filters);
router.get('/auctions/:id', optionalAuth, validate({ params: s.idParams }), auctionC.detail);
router.get('/auctions/:id/bids', validate({ params: s.idParams, query: s.pagingQuery }), auctionC.bids);
router.post('/auctions/:id/bids', authenticate, bidLimiter, validate({ params: s.idParams, body: s.bidBody }), auctionC.createBid);

// Current user's activity
router.get('/users/me/bids', authenticate, validate({ query: s.pagingQuery }), userC.myBids);
router.get('/users/me/auctions', authenticate, userC.myAuctions);

// Administration: authentication + role check are enforced here, server-side, for every route below.
const admin = Router();
admin.use(authenticate, requireRole('admin'));
admin.get('/dashboard', adminC.dashboard);
admin.get('/auctions', validate({ query: s.adminListQuery }), adminC.list);
admin.post('/auctions', validate({ body: s.createAuctionBody }), adminC.create);
admin.get('/auctions/:id', validate({ params: s.idParams }), adminC.detail);
admin.get('/auctions/:id/bids', validate({ params: s.idParams, query: s.pagingQuery }), adminC.bids);
admin.patch('/auctions/:id', validate({ params: s.idParams, body: s.updateAuctionBody }), adminC.update);
admin.post('/auctions/:id/cancel', validate({ params: s.idParams, body: s.cancelBody }), adminC.cancel);
admin.post('/lifecycle/run', adminC.runLifecycle);
router.use('/admin', admin);

export default router;
