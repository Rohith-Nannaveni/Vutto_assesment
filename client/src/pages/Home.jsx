import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { auctionApi } from '../api/index.js';
import { useFetch } from '../hooks/useFetch.js';
import AuctionCard from '../components/AuctionCard.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

function Section({ title, state, emptyText, link }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-xl">{title}</h2>
        {link}
      </div>
      {state.loading && <LoadingState />}
      <ErrorMessage error={state.error} onRetry={state.reload} />
      {!state.loading && !state.error && state.data.data.length === 0 && <EmptyState title="Nothing here right now">{emptyText}</EmptyState>}
      {!state.loading && !state.error && state.data.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.data.map((a) => <AuctionCard key={a.id} auction={a} />)}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const live = useFetch(() => auctionApi.list({ status: 'active', sort: 'endingSoon', limit: 6 }), []);
  const upcoming = useFetch(() => auctionApi.list({ status: 'scheduled', sort: 'endingSoon', limit: 3 }), []);

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-surface-line bg-white p-6 sm:p-8">
        <h1 className="max-w-xl text-2xl sm:text-3xl">Used motorcycles, sold to the highest bidder.</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Every listing is an auction with a fixed end time. Browse freely, then create an account to bid. The server
          checks every bid against the live price and clock, and everyone watching sees the new price immediately.
        </p>
        <Link to="/auctions" className="btn-primary mt-5">Browse all motorcycles <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>

      <Section
        title="Ending soon"
        state={live}
        emptyText="No auctions are live at the moment. Check the upcoming listings below."
        link={<Link to="/auctions?status=active&sort=endingSoon" className="text-sm font-medium text-accent hover:underline">View all live</Link>}
      />
      <Section
        title="Upcoming"
        state={upcoming}
        emptyText="No auctions are scheduled yet."
        link={<Link to="/auctions?status=scheduled" className="text-sm font-medium text-accent hover:underline">View all upcoming</Link>}
      />
    </div>
  );
}
