import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { parseError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

export default function Login() {
  const { user, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? '/';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.email.trim() || !form.password) return setError({ message: 'Enter your email and password.' });
    setSubmitting(true);
    try { await login({ email: form.email.trim(), password: form.password }); navigate(from, { replace: true }); }
    catch (err) { setError(parseError(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl">Sign in</h1>
      <p className="mb-5 text-sm text-ink-muted">New here? <Link to="/register" state={{ from }} className="font-medium text-accent hover:underline">Create an account</Link></p>
      {sessionExpired && <p role="status" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Your session expired. Please sign in again.</p>}
      <form onSubmit={submit} noValidate className="card space-y-4 p-5">
        <ErrorMessage error={error} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
