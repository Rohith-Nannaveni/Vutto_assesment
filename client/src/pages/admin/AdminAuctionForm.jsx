import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../../api/index.js';
import { parseError } from '../../api/client.js';
import { useFetch } from '../../hooks/useFetch.js';
import LoadingState from '../../components/LoadingState.jsx';
import ErrorMessage from '../../components/ErrorMessage.jsx';
import { CONDITION_LABELS, toLocalInput } from '../../utils/format.js';

const EMPTY = {
  title: '', brand: '', model: '', year: String(new Date().getFullYear() - 3), mileageKm: '', engineCc: '', condition: 'good',
  description: '', location: '', images: '', startingPrice: '', minIncrement: '1000',
  startTime: toLocalInput(new Date(Date.now() + 3600e3)), endTime: toLocalInput(new Date(Date.now() + 3 * 86400e3)),
};
// Mirrors the server's edit rules; the server enforces them regardless.
const LIVE_EDITABLE = ['description', 'location', 'images'];
const NUMERIC = ['year', 'mileageKm', 'engineCc', 'startingPrice', 'minIncrement'];

export default function AdminAuctionForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const existing = useFetch(() => (editing ? adminApi.get(id) : Promise.resolve(null)), [id]);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('scheduled');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const a = existing.data?.data;
    if (!a) return;
    setStatus(a.status);
    setForm({
      title: a.title, brand: a.brand, model: a.model, year: String(a.year), mileageKm: String(a.mileageKm), engineCc: String(a.engineCc),
      condition: a.condition, description: a.description, location: a.location, images: a.images.join('\n'),
      startingPrice: String(a.startingPrice), minIncrement: String(a.minIncrement), startTime: toLocalInput(a.startTime), endTime: toLocalInput(a.endTime),
    });
  }, [existing.data]);

  const locked = (name) => editing && status === 'active' && !LIVE_EDITABLE.includes(name);
  const closed = editing && (status === 'ended' || status === 'cancelled');
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const toPayload = () => {
    const body = {};
    for (const [k, v] of Object.entries(form)) {
      if (locked(k)) continue;
      if (NUMERIC.includes(k)) body[k] = v === '' ? undefined : Number(v);
      else if (k === 'images') body[k] = v.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (k === 'startTime' || k === 'endTime') body[k] = new Date(v).toISOString();
      else body[k] = v;
    }
    return body;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setFieldErrors({});
    setSubmitting(true);
    try {
      const { data } = editing ? await adminApi.update(id, toPayload()) : await adminApi.create(toPayload());
      navigate(`/admin/auctions/${data.id}`);
    } catch (err) {
      const parsed = parseError(err);
      if (parsed.fields) setFieldErrors(parsed.fields);
      setError(parsed);
    } finally { setSubmitting(false); }
  };

  if (editing && existing.loading) return <LoadingState />;
  if (editing && existing.error) return <ErrorMessage error={existing.error} onRetry={existing.reload} />;

  const input = (name, label, props = {}) => (
    <div className={props.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={name} className="label">{label}</label>
      {props.as === 'textarea' ? (
        <textarea id={name} rows={props.rows ?? 4} className="input" value={form[name]} onChange={set(name)} disabled={locked(name) || closed} aria-invalid={Boolean(fieldErrors[name])} />
      ) : props.as === 'select' ? (
        <select id={name} className="input" value={form[name]} onChange={set(name)} disabled={locked(name) || closed}>{props.children}</select>
      ) : (
        <input id={name} type={props.type ?? 'text'} className="input" value={form[name]} onChange={set(name)} disabled={locked(name) || closed} min={props.min} aria-invalid={Boolean(fieldErrors[name])} />
      )}
      {props.hint && <p className="mt-1 text-xs text-ink-muted">{props.hint}</p>}
      {fieldErrors[name] && <p className="field-error">{fieldErrors[name]}</p>}
    </div>
  );

  const imageErrors = Object.entries(fieldErrors).filter(([k]) => k.startsWith('images.')).map(([, v]) => v);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><Link to="/admin" className="text-sm text-ink-muted hover:text-ink">← Dashboard</Link><h1 className="mt-1 text-2xl">{editing ? 'Edit listing' : 'New listing'}</h1></div>
      {editing && status === 'active' && <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This auction is live, so price and timing are locked. You can still update the description, location and photos.</p>}
      {closed && <p className="rounded-md border border-surface-line bg-white p-3 text-sm text-ink-muted">This auction is {status} and can no longer be edited.</p>}
      <form onSubmit={submit} noValidate className="card grid gap-4 p-5 sm:grid-cols-2">
        <ErrorMessage error={error && !error.fields ? error : null} className="sm:col-span-2" />
        {error?.fields && <p role="alert" className="field-error sm:col-span-2">{error.message}</p>}
        {input('title', 'Title', { wide: true })}
        {input('brand', 'Brand')}
        {input('model', 'Model')}
        {input('year', 'Year', { type: 'number' })}
        {input('mileageKm', 'Mileage (km)', { type: 'number', min: 0 })}
        {input('engineCc', 'Engine (cc)', { type: 'number', min: 50 })}
        {input('condition', 'Condition', { as: 'select', children: Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>) })}
        {input('location', 'Location')}
        {input('description', 'Description', { as: 'textarea', wide: true, hint: 'At least 20 characters. Mention service history and any damage.' })}
        <div className="sm:col-span-2">
          <label htmlFor="images" className="label">Image URLs (one per line)</label>
          <textarea id="images" rows={3} className="input" value={form.images} onChange={set('images')} disabled={closed} placeholder="/images/bikes/ktm-duke-390-1.svg or https://…" />
          <p className="mt-1 text-xs text-ink-muted">Use direct http(s) image links or site paths. Images that fail to load show a placeholder.</p>
          {imageErrors.map((m) => <p key={m} className="field-error">{m}</p>)}
          {fieldErrors.images && <p className="field-error">{fieldErrors.images}</p>}
        </div>
        {input('startingPrice', 'Starting price (₹)', { type: 'number', min: 1 })}
        {input('minIncrement', 'Minimum increment (₹)', { type: 'number', min: 1 })}
        {input('startTime', 'Auction start', { type: 'datetime-local', hint: 'A start time in the past makes the auction live immediately.' })}
        {input('endTime', 'Auction end', { type: 'datetime-local', hint: 'Between 5 minutes and 30 days after the start.' })}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={submitting || closed}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Create listing'}</button>
          <Link to="/admin" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
