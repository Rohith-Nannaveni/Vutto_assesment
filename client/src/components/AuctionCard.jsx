import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import BikeImage from './BikeImage.jsx';
import { formatCurrency, formatKm, formatNumber } from '../utils/format.js';

function priceLine(a) {
  if (a.status === 'ended') return a.hasWinner ? { label: 'Sold for', value: a.finalPrice } : { label: 'Result', text: 'No bids' };
  if (a.status === 'cancelled') return { label: 'Last price', value: a.currentBid };
  return a.bidCount === 0 ? { label: 'Starting bid', value: a.startingPrice } : { label: 'Current bid', value: a.currentBid };
}

export default function AuctionCard({ auction: a }) {
  const price = priceLine(a);
  const offsetMs = a.serverTime ? new Date(a.serverTime).getTime() - Date.now() : 0;
  return (
    <article className="card overflow-hidden transition-shadow hover:shadow-md">
      <Link to={`/auctions/${a.id}`} className="block focus-visible:outline-offset-[-2px]">
        <div className="relative">
          <BikeImage src={a.images?.[0]} alt={`${a.title}`} className="aspect-[4/3] w-full" />
          <div className="absolute left-3 top-3"><StatusBadge status={a.status} /></div>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <h3 className="line-clamp-1 text-base">{a.title}</h3>
            <p className="mt-0.5 text-sm text-ink-muted">
              {a.year} · {formatKm(a.mileageKm)} · {formatNumber(a.engineCc)} cc
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint"><MapPin size={12} aria-hidden="true" />{a.location}</p>
          </div>
          <div className="flex items-end justify-between gap-3 border-t border-surface-line pt-3">
            <div>
              <p className="text-xs text-ink-muted">{price.label}</p>
              <p className="text-lg font-semibold">{price.text ?? formatCurrency(price.value)}</p>
            </div>
            <div className="text-right text-sm text-ink-muted">
              <CountdownTimer startTime={a.startTime} endTime={a.endTime} status={a.status} offsetMs={offsetMs} />
              {a.status === 'active' && <p className="text-xs text-ink-faint">{a.bidCount} {a.bidCount === 1 ? 'bid' : 'bids'}</p>}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
