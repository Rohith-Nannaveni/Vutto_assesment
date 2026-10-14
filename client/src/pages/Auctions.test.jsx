import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeAuction } from '../test/fixtures.js';

const api = vi.hoisted(() => ({ list: vi.fn(), filters: vi.fn() }));
vi.mock('../api/index.js', () => ({ auctionApi: api }));
import Auctions from './Auctions.jsx';

const FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const renderPage = (url = '/auctions') => render(<MemoryRouter future={FUTURE} initialEntries={[url]}><Auctions /></MemoryRouter>);

describe('Auctions listing states', () => {
  beforeEach(() => { api.list.mockReset(); api.filters.mockResolvedValue({ data: { brands: ['KTM', 'Honda'] } }); });

  it('shows a loading indicator, then the results', async () => {
    api.list.mockResolvedValue({ data: [makeAuction(), makeAuction({ id: 'a2', title: '2021 Honda CB350' })], meta: { page: 1, limit: 9, total: 2, totalPages: 1 } });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(await screen.findByText('2021 Honda CB350')).toBeInTheDocument();
    expect(screen.getByText('2 motorcycles')).toBeInTheDocument();
  });

  it('shows an empty state with a way to clear filters', async () => {
    api.list.mockResolvedValue({ data: [], meta: { page: 1, limit: 9, total: 0, totalPages: 1 } });
    renderPage('/auctions?q=zzz');
    expect(await screen.findByText(/no motorcycles match/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /clear/i }).length).toBeGreaterThan(0);
  });

  it('shows an error with a retry that refetches', async () => {
    api.list.mockRejectedValueOnce({ message: 'Network Error' });
    api.list.mockResolvedValueOnce({ data: [makeAuction()], meta: { page: 1, limit: 9, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('2018 KTM Duke 390')).toBeInTheDocument();
  });

  it('sends search and filter values to the API', async () => {
    api.list.mockResolvedValue({ data: [], meta: { page: 1, limit: 9, total: 0, totalPages: 1 } });
    renderPage('/auctions?q=duke&status=active');
    await screen.findByText(/no motorcycles match/i);
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ q: 'duke', status: 'active', page: 1 }));
  });
});
