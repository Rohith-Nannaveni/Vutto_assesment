import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auctionApi } from '../api/index.js';
import { useFetch } from '../hooks/useFetch.js';
import AuctionCard from '../components/AuctionCard.jsx';
import Pagination from '../components/Pagination.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { CONDITION_LABELS } from '../utils/format.js';

const FILTER_KEYS = ['q', 'brand', 'condition', 'status', 'minPrice', 'maxPrice', 'sort'];

export default function Auctions() {
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
  const page = Number(params.get('page')) || 1;
  const [draft, setDraft] = useState(query);
  const brands = useFetch(() => auctionApi.filters(), []);

  // Keep the form in sync when the URL changes (navbar search, back button).
  useEffect(() => { setDraft(Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']))); }, [params]);

  const apiParams = { ...Object.fromEntries(Object.entries(query).filter(([, v]) => v !== '')), page, limit: 9 };
  const { data, loading, error, reload } = useFetch(() => auctionApi.list(apiParams), [params.toString()]);

  const update = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const apply = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    Object.entries(draft).forEach(([k, v]) => { if (String(v).trim()) next.set(k, String(v).trim()); });
    setParams(next);
  };
  const reset = () => { setParams(new URLSearchParams()); };
  const goToPage = (p) => { const next = new URLSearchParams(params); next.set('page', String(p)); setParams(next); window.scrollTo({ top: 0 }); };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl">Browse motorcycles</h1>

      <form onSubmit={apply} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filters">
        <div className="sm:col-span-2 lg:col-span-2">
          <label htmlFor="f-q" className="label">Search</label>
          <input id="f-q" className="input" placeholder="Title, brand or model" value={draft.q} onChange={update('q')} />
        </div>
        <div>
          <label htmlFor="f-brand" className="label">Brand</label>
          <select id="f-brand" className="input" value={draft.brand} onChange={update('brand')}>
            <option value="">All brands</option>
            {brands.data?.data.brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="label">Status</label>
          <select id="f-status" className="input" value={draft.status} onChange={update('status')}>
            <option value="">Any status</option>
            <option value="active">Live</option>
            <option value="scheduled">Upcoming</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-condition" className="label">Condition</label>
          <select id="f-condition" className="input" value={draft.condition} onChange={update('condition')}>
            <option value="">Any condition</option>
            {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-min" className="label">Min price (₹)</label>
          <input id="f-min" type="number" min="0" inputMode="numeric" className="input" value={draft.minPrice} onChange={update('minPrice')} />
        </div>
        <div>
          <label htmlFor="f-max" className="label">Max price (₹)</label>
          <input id="f-max" type="number" min="0" inputMode="numeric" className="input" value={draft.maxPrice} onChange={update('maxPrice')} />
        </div>
        <div>
          <label htmlFor="f-sort" className="label">Sort by</label>
          <select id="f-sort" className="input" value={draft.sort} onChange={update('sort')}>
            <option value="">Newest listed</option>
            <option value="endingSoon">Ending soon</option>
            <option value="priceAsc">Price: low to high</option>
            <option value="priceDesc">Price: high to low</option>
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn-primary">Apply filters</button>
          <button type="button" className="btn-secondary" onClick={reset}>Clear</button>
        </div>
      </form>

      {loading && <LoadingState label="Loading auctions…" />}
      <ErrorMessage error={error} onRetry={reload} />
      {!loading && !error && data.data.length === 0 && (
        <EmptyState title="No motorcycles match your filters" action={<button type="button" className="btn-secondary" onClick={reset}>Clear filters</button>}>
          Try a broader search, a wider price range, or a different status.
        </EmptyState>
      )}
      {!loading && !error && data.data.length > 0 && (
        <>
          <p className="text-sm text-ink-muted">{data.meta.total} {data.meta.total === 1 ? 'motorcycle' : 'motorcycles'}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((a) => <AuctionCard key={a.id} auction={a} />)}
          </div>
          <Pagination meta={data.meta} onPageChange={goToPage} />
        </>
      )}
    </div>
  );
}
