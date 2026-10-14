import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-surface-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-muted">
          Hey guys, BikeBid is an assessment project. Auctions are demonstrations: no payments are taken and no motorcycles change hands. It's just a showcase of my skills :)
        </div>
      </footer>
    </div>
  );
}
