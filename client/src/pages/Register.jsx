import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { parseError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

function validate(f) {
  const errors = {};
  if (f.name.trim().length < 2) errors.name = 'Enter your name (at least 2 characters).';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = 'Enter a valid email address.';
  if (f.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) errors.password = 'Include at least one letter and one number.';
  return errors;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from ?? '/';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    try { await register({ name: form.name.trim(), email: form.email.trim(), password: form.password }); navigate(from, { replace: true }); }
    catch (err) {
      const parsed = parseError(err);
      if (parsed.fields) setFieldErrors(parsed.fields);
      else setError(parsed);
    } finally { setSubmitting(false); }
  };

  const field = (name, label, type, autoComplete) => (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} type={type} autoComplete={autoComplete} className="input" value={form[name]} aria-invalid={Boolean(fieldErrors[name])}
        aria-describedby={fieldErrors[name] ? `${name}-error` : undefined} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      {fieldErrors[name] && <p id={`${name}-error`} className="field-error">{fieldErrors[name]}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl">Create an account</h1>
      <p className="mb-5 text-sm text-ink-muted">Already registered? <Link to="/login" state={{ from }} className="font-medium text-accent hover:underline">Sign in</Link></p>
      <form onSubmit={submit} noValidate className="card space-y-4 p-5">
        <ErrorMessage error={error} />
        {field('name', 'Name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password')}
        <p className="text-xs text-ink-muted">Your name is shown to other bidders in shortened form (for example “A••• K.”). Your email is never shown.</p>
        <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
      </form>
    </div>
  );
}
