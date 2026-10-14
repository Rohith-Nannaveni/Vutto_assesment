import { http } from './client.js';

const unwrap = (promise) => promise.then((r) => r.data);

export const authApi = {
  me: () => unwrap(http.get('/auth/me')),
  login: (body) => unwrap(http.post('/auth/login', body)),
  register: (body) => unwrap(http.post('/auth/register', body)),
  logout: () => unwrap(http.post('/auth/logout')),
  socketToken: () => unwrap(http.get('/auth/socket-token')),
};

export const auctionApi = {
  list: (params) => unwrap(http.get('/auctions', { params })),
  filters: () => unwrap(http.get('/auctions/filters')),
  get: (id) => unwrap(http.get(`/auctions/${id}`)),
  bids: (id, params) => unwrap(http.get(`/auctions/${id}/bids`, { params })),
  placeBid: (id, amount) => unwrap(http.post(`/auctions/${id}/bids`, { amount })),
};

export const userApi = {
  bids: (params) => unwrap(http.get('/users/me/bids', { params })),
  auctions: () => unwrap(http.get('/users/me/auctions')),
};

export const adminApi = {
  dashboard: () => unwrap(http.get('/admin/dashboard')),
  list: (params) => unwrap(http.get('/admin/auctions', { params })),
  get: (id) => unwrap(http.get(`/admin/auctions/${id}`)),
  bids: (id, params) => unwrap(http.get(`/admin/auctions/${id}/bids`, { params })),
  create: (body) => unwrap(http.post('/admin/auctions', body)),
  update: (id, body) => unwrap(http.patch(`/admin/auctions/${id}`, body)),
  cancel: (id, reason) => unwrap(http.post(`/admin/auctions/${id}/cancel`, { reason })),
  runLifecycle: () => unwrap(http.post('/admin/lifecycle/run')),
};
