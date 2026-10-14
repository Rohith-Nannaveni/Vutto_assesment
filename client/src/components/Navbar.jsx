import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bike, Menu, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const linkClass = ({ isActive }) =>
  `rounded px-2 py-1 text-sm ${isActive ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'}`;

export default function Navbar() {
  const { user, isAdmin, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const search = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/auctions?q=${encodeURIComponent(q)}` : '/auctions');
    setOpen(false);
  };
  const signOut = async () => { await logout(); setOpen(false); navigate('/'); };

  const links = (
    <>
      <NavLink to="/auctions" className={linkClass} onClick={() => setOpen(false)}>Browse</NavLink>
      {user && <NavLink to="/activity" className={linkClass} onClick={() => setOpen(false)}>My activity</NavLink>}
      {isAdmin && <NavLink to="/admin" className={linkClass} onClick={() => setOpen(false)}>Admin</NavLink>}
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-surface-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-white"><Bike size={16} aria-hidden="true" /></span>
          <span className="hidden sm:inline">BikeBid</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">{links}</nav>

        <form onSubmit={search} role="search" className="relative ml-auto hidden w-64 sm:block">
          <label htmlFor="nav-search" className="sr-only">Search motorcycles</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input id="nav-search" className="input h-9 pl-9" placeholder="Search brand or model" value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {!loading && (user ? (
            <>
              <Link to="/account" className="hidden max-w-[10rem] truncate text-sm text-ink-muted hover:text-ink md:inline">{user.name}</Link>
              <button type="button" onClick={signOut} className="btn-secondary btn-sm hidden md:inline-flex">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary btn-sm">Sign in</Link>
              <Link to="/register" className="btn-primary btn-sm hidden sm:inline-flex">Register</Link>
            </>
          ))}
          <button type="button" className="btn-secondary btn-sm md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label="Menu">
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="space-y-3 border-t border-surface-line bg-white px-4 py-3 md:hidden">
          <form onSubmit={search} role="search">
            <label htmlFor="mobile-search" className="sr-only">Search motorcycles</label>
            <input id="mobile-search" className="input" placeholder="Search brand or model" value={query} onChange={(e) => setQuery(e.target.value)} />
          </form>
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {links}
            {user && <NavLink to="/account" className={linkClass} onClick={() => setOpen(false)}>Account</NavLink>}
            {user && <button type="button" onClick={signOut} className="px-2 py-1 text-left text-sm text-ink-muted hover:text-ink">Sign out</button>}
            {!user && <NavLink to="/register" className={linkClass} onClick={() => setOpen(false)}>Register</NavLink>}
          </nav>
        </div>
      )}
    </header>
  );
}
