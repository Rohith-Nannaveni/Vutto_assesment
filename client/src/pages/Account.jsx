import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../utils/format.js';

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl">Your account</h1>
      <dl className="card divide-y divide-surface-line px-5 text-sm">
        {[['Name', user.name], ['Email', user.email], ['Role', user.role === 'admin' ? 'Administrator' : 'Buyer'], ['Member since', formatDateTime(user.createdAt)]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-ink-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
      <p className="text-sm text-ink-muted">Other bidders see you as a shortened name. Sessions last 8 hours, then you will be asked to sign in again.</p>
      <button type="button" className="btn-secondary" onClick={async () => { await logout(); navigate('/'); }}>Sign out</button>
    </div>
  );
}
