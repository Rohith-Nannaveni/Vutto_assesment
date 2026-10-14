import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { adminApi } from '../../api/index.js';
import { parseError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorMessage from '../../components/ErrorMessage.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { formatCurrency, formatDateTime } from '../../utils/format.js';

const METRICS = [['total', 'Total auctions'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['ended', 'Ended'], ['totalBids', 'Accepted bids']];

export default function AdminDashboard() {
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const dash = useFetch(() => adminApi.dashboard(), []);
  const list = useFetch(() => adminApi.list({ page, limit: 8, status, q: search }), [page, status, search]);

  const reloadAll = () => { dash.reload({ silent: true }); list.reload({ silent: true }); };

  const confirmCancel = async () => {
    setBusy(true); setActionError(null);
    try {
      await adminApi.cancel(cancelTarget.id, reason.trim() || undefined);
      notify(`Cancelled "${cancelTarget.title}".`, { type: 'success' });
      setCancelTarget(null); setReason(''); reloadAll();
    } catch (err) { setActionError(parseError(err)); } finally { setBusy(false); }
  };

  const runLifecycle = async () => {
    try {
      const { data } = await adminApi.runLifecycle();
      notify(`Lifecycle check done: ${data.activated} activated, ${data.finalized} finalized.`, { type: 'success' });
      reloadAll();
    } catch (err) { notify(parseError(err).message, { type: 'error' }); }
  };

  const t = dash.data?.data.totals;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Admin dashboard</h1>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={runLifecycle}><RefreshCw size={14} aria-hidden="true" /> Run lifecycle check</button>
          <Link to="/admin/auctions/new" className="btn-primary"><Plus size={16} aria-hidden="true" /> New listing</Link>
        </div>
      </div>

      {dash.loading && <LoadingState />}
      <ErrorMessage error={dash.error} onRetry={dash.reload} />
      {t && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {METRICS.map(([k, label]) => (
            <div key={k} className="card p-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-1 text-2xl font-semibold" data-testid={`metric-${k}`}>{t[k]}</p></div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-labelledby="auctions-title">
          <h2 id="auctions-title" className="text-lg">Auctions</h2>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}>
            <label className="sr-only" htmlFor="admin-q">Search by title</label>
            <input id="admin-q" className="input max-w-xs" placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="sr-only" htmlFor="admin-status">Status</label>
            <select id="admin-status" className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="ended">Ended</option><option value="cancelled">Cancelled</option>
            </select>
            <button type="submit" className="btn-secondary">Search</button>
          </form>
          {list.loading && <LoadingState />}
          <ErrorMessage error={list.error} onRetry={list.reload} />
          {list.data && list.data.data.length === 0 && <EmptyState title="No auctions found">Adjust the filters or create a new listing.</EmptyState>}
          {list.data && list.data.data.length > 0 && (
            <>
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-surface-line text-ink-muted"><tr>
                    <th className="p-3 font-medium">Listing</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Price</th><th className="p-3 font-medium">Ends</th><th className="p-3 font-medium"><span className="sr-only">Actions</span></th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-line">
                    {list.data.data.map((a) => {
                      const open = a.status === 'active' || a.status === 'scheduled';
                      return (
                        <tr key={a.id}>
                          <td className="p-3"><Link to={`/admin/auctions/${a.id}`} className="font-medium hover:underline">{a.title}</Link><p className="text-xs text-ink-muted">{a.bidCount} bids</p></td>
                          <td className="p-3"><StatusBadge status={a.status} /></td>
                          <td className="p-3">{formatCurrency(a.status === 'ended' && a.hasWinner ? a.finalPrice : a.currentBid)}</td>
                          <td className="whitespace-nowrap p-3 text-ink-muted">{formatDateTime(a.endTime)}</td>
                          <td className="whitespace-nowrap p-3 text-right">
                            <Link to={`/admin/auctions/${a.id}`} className="btn-secondary btn-sm">View</Link>{' '}
                            {open && <Link to={`/admin/auctions/${a.id}/edit`} className="btn-secondary btn-sm">Edit</Link>}{' '}
                            {open && <button type="button" className="btn-danger btn-sm" onClick={() => { setCancelTarget(a); setActionError(null); }}>Cancel</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={list.data.meta} onPageChange={setPage} />
            </>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="activity-title">
          <h2 id="activity-title" className="text-lg">Recent bids</h2>
          {dash.data && dash.data.data.recentActivity.length === 0 && <p className="text-sm text-ink-muted">No bids have been placed yet.</p>}
          {dash.data && dash.data.data.recentActivity.length > 0 && (
            <ul className="card divide-y divide-surface-line text-sm">
              {dash.data.data.recentActivity.map((r) => (
                <li key={r.id} className="p-3">
                  <p><strong>{formatCurrency(r.amount)}</strong> by {r.bidder}</p>
                  <Link to={`/admin/auctions/${r.auctionId}`} className="text-ink-muted hover:underline">{r.auctionTitle}</Link>
                  <p className="text-xs text-ink-faint">{formatDateTime(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {cancelTarget && (
        <Modal title="Cancel this auction?" onClose={() => setCancelTarget(null)}>
          <p className="mb-3 text-sm text-ink-muted">“{cancelTarget.title}” will stop accepting bids immediately. Existing bids are kept for the record. This cannot be undone.</p>
          <label htmlFor="cancel-reason" className="label">Reason (optional)</label>
          <textarea id="cancel-reason" rows={2} maxLength={300} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          <ErrorMessage error={actionError} className="mt-3" />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCancelTarget(null)}>Keep auction</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={confirmCancel}>{busy ? 'Cancelling…' : 'Cancel auction'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
