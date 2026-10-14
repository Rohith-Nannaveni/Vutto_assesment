import { Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';
import { RequireAdmin, RequireAuth } from './routes/guards.jsx';
import Home from './pages/Home.jsx';
import Auctions from './pages/Auctions.jsx';
import AuctionDetail from './pages/AuctionDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Account from './pages/Account.jsx';
import Activity from './pages/Activity.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminAuctionForm from './pages/admin/AdminAuctionForm.jsx';
import AdminAuctionDetail from './pages/admin/AdminAuctionDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="auctions" element={<Auctions />} />
        <Route path="auctions/:id" element={<AuctionDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route element={<RequireAuth />}>
          <Route path="account" element={<Account />} />
          <Route path="activity" element={<Activity />} />
        </Route>
        <Route path="admin" element={<RequireAdmin />}>
          <Route index element={<AdminDashboard />} />
          <Route path="auctions/new" element={<AdminAuctionForm />} />
          <Route path="auctions/:id" element={<AdminAuctionDetail />} />
          <Route path="auctions/:id/edit" element={<AdminAuctionForm />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
