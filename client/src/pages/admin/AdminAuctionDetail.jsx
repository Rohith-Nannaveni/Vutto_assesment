import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/index.js';
import { parseError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import Modal from '../../components/Modal.jsx';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorMessage from '../../components/ErrorMessage.jsx';
import { CONDITION_LABELS, formatCurrency, formatDateTime, formatKm } from '../../utils/format.js';

export default function AdminAuctionDetail() {
  const { id } = useParams();
  const { notify } = useToast();
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const detail = useFetch(() => adminApi.get(id), [id]);
  const bids = useFetch(() => adminApi.bids(id, { page, limit: 10 }), [id, page]);

  if (detail.loading && !detail.data) return <LoadingState />;
  if (detail.error) return <div className="space-y-3"><ErrorMessage error={detail.error} onRetry={detail.reload} /><Link to="/admin" className="btn-secondary">Back to dashboard</Link></div>;
  const a = detail.data.data;
  const open = a.status === 'active' || a.status === 'scheduled';

  const cancel = async () => {
    setBusy(true); setActionError(null);
    try { await adminApi.cancel(id, reason.trim() || undefined); setConfirm(false); notify('Auction cancelled.', { type: 'success' }); detail.reload({ silent: true }); }
    catch (err) { setActionError(parseError(err)); } finally { setBusy(false); }
  };

  const rows = [
    ['Seller', a.sellerName], ['Brand / model', `${a.brand} ${a.model}`], ['Year', a.year], ['Mileage', formatKm(a.mileageKm)], ['Condition', CONDITION_LABELS[a.condition]],
    ['Location', a.location], ['Starts', formatDateTime(a.startTime)], ['Ends', formatDateTime(a.endTime)], ['Starting price', formatCurrency(a.startingPrice)], ['Increment', formatCurrency(a.minIncrement)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Link to="/admin" className="text-sm text-ink-muted hover:text-ink">← Dashboard</Link><h1 className="mt-1 text-2xl">{a.title}</h1><div className="mt-2 flex items-center gap-3"><StatusBadge status={a.status} /><Link to={`/auctions/${a.id}`} className="text-sm text-accent hover:underline">View public page</Link></div></div>
        <div className="flex gap-2">
          {open && <Link to={`/admin/auctions/${a.id}/edit`} className="btn-secondary">Edit</Link>}
          {open && <button type="button" className="btn-danger" onClick={() => { setConfirm(true); setActionError(null); }}>Cancel auction</button>}
        </div>
      </div>

      {a.status === 'ended' && (
        <div className="card p-4 text-sm">
          <h2 className="mb-1 text-base">Result</h2>
          {a.hasWinner ? <p>Won by <strong>{a.winnerName}</strong> for <strong>{formatCurrency(a.finalPrice)}</strong>. Finalized {formatDateTime(a.finalizedAt)}. The winner is derived from the stored bids and cannot be edited.</p> : <p>Ended with no bids. There is no winner.</p>}
        </div>
      )}
      {a.status === 'cancelled' && <div className="card p-4 text-sm">Cancelled {formatDateTime(a.cancelledAt)}{a.cancelReason ? `: ${a.cancelReason}` : '.'} Bid history is preserved.</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <dl className="card px-5 py-2 lg:col-span-1">
          <div className="flex justify-between border-b border-surface-line py-2 text-sm"><dt className="text-ink-muted">Current bid</dt><dd className="font-semibold">{formatCurrency(a.currentBid)}</dd></div>
          <div className="flex justify-between border-b border-surface-line py-2 text-sm"><dt className="text-ink-muted">Bids</dt><dd className="font-semibold">{a.bidCount}</dd></div>
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-surface-line py-2 text-sm last:border-0"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>

        <section className="space-y-3 lg:col-span-2" aria-labelledby="bid-log">
          <h2 id="bid-log" className="text-lg">Bid history</h2>
          {bids.loading && <LoadingState />}
          <ErrorMessage error={bids.error} onRetry={bids.reload} />
          {bids.data && bids.data.data.length === 0 && <p className="text-sm text-ink-muted">No bids on this auction.</p>}
          {bids.data && bids.data.data.length > 0 && (
            <>
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-surface-line text-ink-muted"><tr><th className="p-3 font-medium">#</th><th className="p-3 font-medium">Bidder</th><th className="p-3 font-medium">Amount</th><th className="p-3 font-medium">Accepted</th></tr></thead>
                  <tbody className="divide-y divide-surface-line">
                    {bids.data.data.map((b) => (
                      <tr key={b.id}><td className="p-3 text-ink-muted">{b.sequence}</td><td className="p-3">{b.bidderName}<p className="text-xs text-ink-muted">{b.bidderEmail}</p></td><td className="p-3 font-medium">{formatCurrency(b.amount)}</td><td className="p-3 text-ink-muted">{formatDateTime(b.createdAt)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={bids.data.meta} onPageChange={setPage} />
            </>
          )}
          <p className="text-xs text-ink-muted">Accepted bids are append-only. Administrators cannot edit, remove or reassign them.</p>
        </section>
      </div>

      {confirm && (
        <Modal title="Cancel this auction?" onClose={() => setConfirm(false)}>
          <p className="mb-3 text-sm text-ink-muted">Bidding stops immediately. Existing bids are kept. This cannot be undone.</p>
          <label htmlFor="reason" className="label">Reason (optional)</label>
          <textarea id="reason" rows={2} maxLength={300} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          <ErrorMessage error={actionError} className="mt-3" />
          <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setConfirm(false)}>Keep auction</button><button type="button" className="btn-primary" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel auction'}</button></div>
        </Modal>
      )}
    </div>
  );
}
