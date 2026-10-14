import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuctionCard from './AuctionCard.jsx';
import { makeAuction } from '../test/fixtures.js';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const renderCard = (over) => render(<MemoryRouter future={FUTURE}><AuctionCard auction={makeAuction(over)} /></MemoryRouter>);

describe('AuctionCard', () => {
  it('shows title, specs, current bid, status and time remaining for a live auction', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: '2018 KTM Duke 390' })).toBeInTheDocument();
    expect(screen.getByText(/2018 · 22,000 km · 373 cc/)).toBeInTheDocument();
    expect(screen.getByText('Current bid')).toBeInTheDocument();
    expect(screen.getByText('₹1,41,000')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^Ends in 4h/);
    expect(screen.getByText('3 bids')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/auctions/a1');
  });

  it('shows the starting bid when nothing has been bid yet', () => {
    renderCard({ bidCount: 0, currentBid: 135000 });
    expect(screen.getByText('Starting bid')).toBeInTheDocument();
    expect(screen.getByText('₹1,35,000')).toBeInTheDocument();
  });

  it('labels upcoming auctions with their start countdown', () => {
    renderCard({ status: 'scheduled', startTime: new Date(Date.now() + 26 * 3600e3).toISOString(), endTime: new Date(Date.now() + 80 * 3600e3).toISOString(), bidCount: 0 });
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(/^Starts in 1d/);
  });

  it('shows the sold price for ended auctions with a winner and "No bids" otherwise', () => {
    const { unmount } = renderCard({ status: 'ended', hasWinner: true, finalPrice: 150000 });
    expect(screen.getByText('Sold for')).toBeInTheDocument();
    expect(screen.getByText('₹1,50,000')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('Ended');
    unmount();
    renderCard({ status: 'ended', hasWinner: false, bidCount: 0 });
    expect(screen.getByText('No bids')).toBeInTheDocument();
  });

  it('shows cancelled auctions as cancelled', () => {
    renderCard({ status: 'cancelled' });
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  it('falls back to a placeholder image when the photo fails to load', () => {
    renderCard();
    const img = screen.getByRole('img');
    fireEvent.error(img);
    return vi.waitFor(() => expect(img.getAttribute('src')).toBe('/images/bikes/placeholder.svg'));
  });
});
