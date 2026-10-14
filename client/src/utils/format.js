const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN');
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export const formatCurrency = (n) => inr.format(n);
export const formatNumber = (n) => num.format(n);
export const formatKm = (n) => `${num.format(n)} km`;
export const formatDateTime = (d) => dateTime.format(new Date(d));

export function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const CONDITION_LABELS = { excellent: 'Excellent', good: 'Good', fair: 'Fair', 'needs-work': 'Needs work' };
export const STATUS_LABELS = { scheduled: 'Upcoming', active: 'Live', ended: 'Ended', cancelled: 'Cancelled' };

// Converts an ISO string to the value format <input type="datetime-local"> expects (local time).
export function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
