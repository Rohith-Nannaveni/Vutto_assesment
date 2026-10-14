import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-1 text-2xl">We can't find that page</h1>
      <p className="mt-2 text-sm text-ink-muted">The link may be out of date, or the auction may have been removed.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link to="/" className="btn-secondary">Home</Link>
        <Link to="/auctions" className="btn-primary">Browse motorcycles</Link>
      </div>
    </div>
  );
}
