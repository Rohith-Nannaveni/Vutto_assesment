import axios from 'axios';

// Default '/api' is same-origin (Vite proxy in dev, Vercel rewrite in production).
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const http = axios.create({ baseURL, withCredentials: true, timeout: 15000 });

// The CSRF token lives in memory only. It is re-issued by GET /auth/me after a refresh.
let csrfToken = null;
export const setCsrfToken = (token) => { csrfToken = token; };

let onSessionInvalid = null;
export const setSessionInvalidHandler = (fn) => { onSessionInvalid = fn; };

http.interceptors.request.use((config) => {
  if (csrfToken && !['get', 'head', 'options'].includes(config.method)) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    if (error.response?.status === 401 && (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN')) onSessionInvalid?.(code);
    return Promise.reject(error);
  },
);

// Normalises any failure into { message, code, status, fields, details }.
export function parseError(error) {
  if (error?.response) {
    const { data, status } = error.response;
    return { message: data?.message ?? 'Something went wrong.', code: data?.code, status, fields: data?.details?.fields, details: data?.details };
  }
  if (error?.code === 'ECONNABORTED') return { message: 'The server took too long to respond. Please try again.', code: 'TIMEOUT' };
  return { message: 'Cannot reach the server. Check your connection and try again.', code: 'NETWORK_ERROR' };
}
