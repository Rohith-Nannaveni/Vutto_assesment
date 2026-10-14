import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeAuction } from '../test/fixtures.js';

const api = vi.hoisted(() => ({ get: vi.fn(), bids: vi.fn(), placeBid: vi.fn() }));
vi.mock('../api/index.js', () => ({ auctionApi: api }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Test Buyer', role: 'buyer' } }) }));
vi.mock('../context/SocketContext.jsx', () => ({ useSocket: () => ({ socket: null, status: 'connected' }) }));
vi.mock('../context/ToastContext.jsx', () => ({ useToast: () => ({ notify: vi.fn() }) }));

import AuctionDetail from './AuctionDetail.jsx';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const renderPage = () => render(
  <MemoryRouter future={FUTURE} initialEntries={['/auctions/a1']}>
    <Routes><Route path="/auctions/:id" element={<AuctionDetail />} /></Routes>
  </MemoryRouter>,
);

describe('AuctionDetail bidding', () => {
  beforeEach(() => {
    api.get.mockReset(); api.bids.mockReset(); api.placeBid.mockReset();
    api.get.mockResolvedValue({ data: makeAuction() });
    api.bids.mockResolvedValue({ data: [{ id: 'b1', amount: 141000, bidder: 'R••• S.', sequence: 3, createdAt: new Date().toISOString() }], meta: { total: 1 } });
  });

  it('renders price, minimum next bid, countdown, connection status and bid history', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: '2018 KTM Duke 390' })).toBeInTheDocument();
    expect(screen.getByTestId('current-bid')).toHaveTextContent('₹1,41,000');
    expect(screen.getByText(/Minimum next bid:/)).toHaveTextContent('₹1,43,000');
    expect(screen.getByText('Live updates on')).toBeInTheDocument();
    expect(await screen.findByText('R••• S.')).toBeInTheDocument();
  });

  it('updates the price and shows confirmation when the server accepts a bid', async () => {
    api.placeBid.mockResolvedValue({
      data: {
        bid: { id: 'b2', amount: 145000, bidder: 'T••• B.', sequence: 4, createdAt: new Date().toISOString() },
        auction: makeAuction({ currentBid: 145000, bidCount: 4, minimumNextBid: 147000, isLeading: true }), bidderCount: 2,
      },
    });
    renderPage();
    await userEvent.type(await screen.findByLabelText(/your bid/i), '145000');
    await userEvent.click(screen.getByRole('button', { name: /place bid/i }));
    expect(api.placeBid).toHaveBeenCalledWith('a1', 145000);
    await waitFor(() => expect(screen.getByTestId('current-bid')).toHaveTextContent('₹1,45,000'));
    expect(screen.getByText(/was accepted/i)).toBeInTheDocument();
    expect(screen.getByText('You are the highest bidder.')).toBeInTheDocument();
  });

  it('shows the server message and leaves the price unchanged when a bid is rejected', async () => {
    api.placeBid.mockRejectedValue({ response: { status: 422, data: { code: 'BID_TOO_LOW', message: 'Your bid must be at least 150000.' } } });
    renderPage();
    await userEvent.type(await screen.findByLabelText(/your bid/i), '143000');
    await userEvent.click(screen.getByRole('button', { name: /place bid/i }));
    expect(await screen.findByText('Your bid must be at least 150000.')).toBeInTheDocument();
    expect(screen.getByTestId('current-bid')).toHaveTextContent('₹1,41,000');
    expect(screen.queryByText(/was accepted/i)).not.toBeInTheDocument();
  });

  it('hides the bid form on ended auctions and shows the result', async () => {
    api.get.mockResolvedValue({ data: makeAuction({ status: 'ended', hasWinner: true, finalPrice: 150000, isWinner: true }) });
    renderPage();
    expect(await screen.findByText(/You won this auction/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your bid/i)).not.toBeInTheDocument();
  });

  it('shows a clear error for an auction that does not exist', async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: { code: 'AUCTION_NOT_FOUND', message: 'Auction not found.' } } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not exist/i);
  });
});
