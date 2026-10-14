import { useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from '../api/index.js';
import { useFetch } from '../hooks/useFetch.js';
import StatusBadge from '../components/StatusBadge.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import BikeImage from '../components/BikeImage.jsx';
import Pagination from '../components/Pagination.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatCurrency, formatDateTime } from '../utils/format.js';

const GROUPS = [
  ['leading', 'Leading', 'You are the highest bidder on these live auctions.'],
  ['outbid', 'Outbid', 'Someone has bid higher. Open one to raise your bid.'],
  ['won', 'Won', 'Auctions that ended with you as the highest bidder.'],
  ['lost', 'Lost', 'Auctions that ended with a higher bid than yours.'],
  ['cancelled', 'Cancelled', 'Auctions you bid on that were cancelled by an administrator.'],
];

function Row({ a, group }) {
  const price = a.status === 'ended' && a.hasWinner ? a.finalPrice : a.currentBid;
  return (
    <li>
      <Link to={`/auctions/${a.id}`} className="flex items-center gap-4 p-3 hover:bg-surface-page">
        <BikeImage src={a.images?.[0]} alt="" className="h-14 w-20 shrink-0 rounded" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{a.title}</p>
          <p className="text-sm text-ink-muted">Your highest bid {formatCurrency(a.myHighestBid)} · {group === 'won' || group === 'lost' ? 'Final' : 'Current'} {formatCurrency(price)}</p>
        </div>
        <div className="hidden text-right text-sm text-ink-muted sm:block">
          <StatusBadge status={a.status} />
          <p className="mt-1"><CountdownTimer startTime={a.startTime} endTime={a.endTime} status={a.status} /></p>
        </div>
      </Link>
    </li>
  );
}

export default function Activity() {
  const [page, setPage] = useState(1);
  const auctions = useFetch(() => userApi.auctions(), []);
  const bids = useFetch(() => userApi.bids({ page, limit: 8 }), [page]);

  const groups = auctions.data?.data;
  const empty = groups && GROUPS.every(([k]) => groups[k].length === 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl">My activity</h1>
      {auctions.loading && <LoadingState />}
      <ErrorMessage error={auctions.error} onRetry={auctions.reload} />
      {empty && (
        <EmptyState title="You haven't placed any bids yet" action={<Link to="/auctions?status=active" className="btn-primary">Browse live auctions</Link>}>
          Auctions you bid on will be sorted here as leading, outbid, won or lost.
        </EmptyState>
      )}
      {groups && !empty && GROUPS.filter(([k]) => groups[k].length > 0).map(([key, title, hint]) => (
        <section key={key} aria-labelledby={`g-${key}`} className="space-y-2">
          <div><h2 id={`g-${key}`} className="text-lg">{title} <span className="text-sm font-normal text-ink-muted">({groups[key].length})</span></h2><p className="text-sm text-ink-muted">{hint}</p></div>
          <ul className="card divide-y divide-surface-line overflow-hidden">{groups[key].map((a) => <Row key={a.id} a={a} group={key} />)}</ul>
        </section>
      ))}

      <section aria-labelledby="recent-bids" className="space-y-2">
        <h2 id="recent-bids" className="text-lg">Recent bids</h2>
        {bids.loading && <LoadingState />}
        <ErrorMessage error={bids.error} onRetry={bids.reload} />
        {bids.data && bids.data.data.length === 0 && <p className="text-sm text-ink-muted">No bids yet.</p>}
        {bids.data && bids.data.data.length > 0 && (
          <>
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-surface-line text-ink-muted"><tr><th className="p-3 font-medium">Motorcycle</th><th className="p-3 font-medium">Your bid</th><th className="p-3 font-medium">When</th><th className="p-3 font-medium">Now</th></tr></thead>
                <tbody className="divide-y divide-surface-line">
                  {bids.data.data.map((b) => (
                    <tr key={b.id}>
                      <td className="p-3"><Link to={`/auctions/${b.auction?.id}`} className="font-medium hover:underline">{b.auction?.title}</Link></td>
                      <td className="p-3">{formatCurrency(b.amount)}</td>
                      <td className="p-3 text-ink-muted">{formatDateTime(b.createdAt)}</td>
                      <td className="p-3">{b.auction?.status === 'active' ? (b.auction.isLeading ? 'Leading' : 'Outbid') : <StatusBadge status={b.auction?.status} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={bids.data.meta} onPageChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
