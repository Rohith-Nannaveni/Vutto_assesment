import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MapPin, Trophy } from 'lucide-react';
import { auctionApi } from '../api/index.js';
import { parseError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuctionRoom } from '../hooks/useAuctionRoom.js';
import { useFetch } from '../hooks/useFetch.js';
import BidForm from '../components/BidForm.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import BikeImage from '../components/BikeImage.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { CONDITION_LABELS, formatCurrency, formatDateTime, formatKm, formatNumber } from '../utils/format.js';

function Spec({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-surface-line py-2 text-sm last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default function AuctionDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { notify } = useToast();
  const { data, loading, error, reload } = useFetch(() => auctionApi.get(id), [id, user?.id]);
  const bidsState = useFetch(() => auctionApi.bids(id, { limit: 15 }), [id]);

  const [auction, setAuction] = useState(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [bidders, setBidders] = useState(null);
  const [bids, setBids] = useState([]);
  const [hasBid, setHasBid] = useState(false);
  const [image, setImage] = useState(0);
  const [success, setSuccess] = useState('');
  const myBidIds = useRef(new Set());

  const adopt = useCallback((a) => {
    setAuction(a);
    setOffsetMs(new Date(a.serverTime).getTime() - Date.now());
  }, []);

  useEffect(() => { if (data) { adopt(data.data); setImage(0); } }, [data, adopt]);
  useEffect(() => { if (bidsState.data) setBids(bidsState.data.data); }, [bidsState.data]);

  useAuctionRoom(id, {
    onSnapshot: (a) => { adopt(a); bidsState.reload({ silent: true }); },
    onBidUpdated: (e) => {
      const mine = myBidIds.current.has(e.bid.id);
      setAuction((a) => a && {
        ...a, currentBid: e.currentBid, minimumNextBid: e.minimumNextBid, bidCount: e.bidCount, status: e.status, endTime: e.endTime,
        isLeading: mine,
      });
      setOffsetMs(new Date(e.serverTime).getTime() - Date.now());
      setBidders(e.bidderCount);
      setBids((prev) => (prev.some((b) => b.id === e.bid.id) ? prev : [e.bid, ...prev].slice(0, 15)));
    },
    onStatusChanged: () => reload({ silent: true }),
  });

  const reloadBids = bidsState.reload;
  const refresh = useCallback(() => { reload({ silent: true }); reloadBids({ silent: true }); }, [reload, reloadBids]);

  const placeBid = async (amount) => {
    setSuccess('');
    try {
      const { data: result } = await auctionApi.placeBid(id, amount);
      myBidIds.current.add(result.bid.id);
      setHasBid(true);
      adopt(result.auction);
      setBidders(result.bidderCount);
      setBids((prev) => (prev.some((b) => b.id === result.bid.id) ? prev : [result.bid, ...prev].slice(0, 15)));
      setSuccess(`Your bid of ${formatCurrency(result.bid.amount)} was accepted. You are the highest bidder.`);
      return { ok: true };
    } catch (err) {
      const e = parseError(err);
      if (['BID_TOO_LOW', 'AUCTION_ENDED', 'AUCTION_CANCELLED', 'AUCTION_NOT_STARTED', 'ALREADY_HIGHEST', 'BID_CONFLICT'].includes(e.code)) refresh();
      return { ok: false, message: e.message };
    }
  };

  const gallery = useMemo(() => auction?.images ?? [], [auction?.images]);

  if (loading && !auction) return <LoadingState label="Loading auction…" />;
  if (error && !auction) {
    return (
      <div className="space-y-4">
        <ErrorMessage error={error.status === 404 ? 'This auction does not exist or has been removed.' : error} onRetry={error.status === 404 ? undefined : reload} />
        <Link to="/auctions" className="btn-secondary">Back to browse</Link>
      </div>
    );
  }
  if (!auction) return null;

  const a = auction;
  const open = a.status === 'active' || a.status === 'scheduled';
  const canBid = user && a.status === 'active' && !a.isOwnListing;
  const outbid = hasBid && !a.isLeading && a.status === 'active';

  let bidPanel;
  if (a.status === 'ended') {
    bidPanel = a.hasWinner
      ? (
        <p className="flex items-start gap-2 text-sm">
          <Trophy size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>Sold for <strong>{formatCurrency(a.finalPrice)}</strong>.{a.isWinner && ' You won this auction.'}</span>
        </p>
      )
      : <p className="text-sm text-ink-muted">This auction ended without any bids.</p>;
  } else if (a.status === 'cancelled') {
    bidPanel = <p className="text-sm text-ink-muted">This auction was cancelled{a.cancelReason ? `: ${a.cancelReason}` : '.'} No further bids are accepted.</p>;
  } else if (a.status === 'scheduled') {
    bidPanel = <p className="text-sm text-ink-muted">Bidding opens {formatDateTime(a.startTime)}. The first bid must be at least {formatCurrency(a.startingPrice)}.</p>;
  } else if (!user) {
    bidPanel = <Link to="/login" state={{ from: location.pathname }} className="btn-primary w-full">Sign in to bid</Link>;
  } else if (a.isOwnListing) {
    bidPanel = <p className="text-sm text-ink-muted">You listed this motorcycle, so you cannot bid on it.</p>;
  } else {
    bidPanel = <BidForm minimumNextBid={a.minimumNextBid} onSubmit={placeBid} disabled={!canBid} />;
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link to="/auctions" className="hover:text-ink">Browse</Link> <span aria-hidden="true">/</span> {a.brand}
      </nav>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <BikeImage src={gallery[image]} alt={a.title} className="aspect-[4/3] w-full rounded-lg border border-surface-line" />
          {gallery.length > 1 && (
            <ul className="flex gap-2" aria-label="Photos">
              {gallery.map((src, i) => (
                <li key={src}>
                  <button type="button" onClick={() => setImage(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === image} className={`overflow-hidden rounded border-2 ${i === image ? 'border-accent' : 'border-transparent'}`}>
                    <BikeImage src={src} alt="" className="h-16 w-20" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <section className="card p-4">
            <h2 className="mb-2 text-base">About this motorcycle</h2>
            <p className="whitespace-pre-line text-sm text-ink-muted">{a.description}</p>
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-2">
          <div className="card space-y-4 p-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2"><StatusBadge status={a.status} /><ConnectionStatus /></div>
              <h1 className="text-xl">{a.title}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted"><MapPin size={14} aria-hidden="true" />{a.location}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-y border-surface-line py-4">
              <div>
                <p className="text-xs text-ink-muted">{a.bidCount === 0 ? 'Starting bid' : a.status === 'ended' && a.hasWinner ? 'Final price' : 'Current bid'}</p>
                <p className="text-2xl font-semibold" data-testid="current-bid">{formatCurrency(a.status === 'ended' && a.hasWinner ? a.finalPrice : a.bidCount === 0 ? a.startingPrice : a.currentBid)}</p>
                <p className="text-xs text-ink-muted">
                  {a.bidCount} {a.bidCount === 1 ? 'bid' : 'bids'}{bidders ? ` · ${bidders} ${bidders === 1 ? 'bidder' : 'bidders'}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Time</p>
                <p className="text-lg font-semibold"><CountdownTimer startTime={a.startTime} endTime={a.endTime} status={a.status} offsetMs={offsetMs} onElapsed={refresh} /></p>
                <p className="text-xs text-ink-muted">{a.status === 'scheduled' ? 'Opens' : 'Closes'} {formatDateTime(a.status === 'scheduled' ? a.startTime : a.endTime)}</p>
              </div>
            </div>

            {open && a.status === 'active' && (
              <p className="text-sm">Minimum next bid: <strong>{formatCurrency(a.minimumNextBid)}</strong> <span className="text-ink-muted">(increment {formatCurrency(a.minIncrement)})</span></p>
            )}
            {a.isLeading && <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">You are the highest bidder.</p>}
            {outbid && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">You have been outbid. Place a higher bid to take the lead.</p>}
            {bidPanel}
            {success && <p role="status" className="text-sm text-green-800">{success}</p>}
          </div>

          <dl className="card px-5 py-2">
            <Spec label="Brand / model" value={`${a.brand} ${a.model}`} />
            <Spec label="Year" value={a.year} />
            <Spec label="Mileage" value={formatKm(a.mileageKm)} />
            <Spec label="Engine" value={`${formatNumber(a.engineCc)} cc`} />
            <Spec label="Condition" value={CONDITION_LABELS[a.condition]} />
            <Spec label="Starting price" value={formatCurrency(a.startingPrice)} />
          </dl>
        </aside>
      </div>

      <section className="card p-5" aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 text-base">Bid history</h2>
        {bidsState.loading && bids.length === 0 && <LoadingState label="Loading bids…" />}
        <ErrorMessage error={bidsState.error} onRetry={bidsState.reload} />
        {!bidsState.loading && !bidsState.error && bids.length === 0 && <p className="text-sm text-ink-muted">No bids yet. The first bid sets the price.</p>}
        {bids.length > 0 && (
          <ul className="divide-y divide-surface-line text-sm">
            {bids.map((b, i) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>{b.bidder}{i === 0 && a.status === 'active' && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent">Highest</span>}</span>
                <span className="text-right"><strong>{formatCurrency(b.amount)}</strong> <span className="ml-2 text-xs text-ink-muted">{formatDateTime(b.createdAt)}</span></span>
              </li>
            ))}
          </ul>
        )}
        {bidsState.data && bidsState.data.meta.total > bids.length && <p className="mt-3 text-xs text-ink-muted">Showing the latest {bids.length} of {bidsState.data.meta.total} bids.</p>}
      </section>
    </div>
  );
}
