import { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/format.js';

// The minimum shown here is a convenience. The server recalculates it and has the final say.
export default function BidForm({ minimumNextBid, onSubmit, disabled = false }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Keep the suggestion fresh as other bidders raise the price.
  useEffect(() => { setError(''); }, [minimumNextBid]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = value.trim().replace(/,/g, '');
    if (!/^\d+$/.test(trimmed)) return setError('Enter a whole-number amount in rupees.');
    const amount = Number(trimmed);
    if (amount < minimumNextBid) return setError(`Your bid must be at least ${formatCurrency(minimumNextBid)}.`);
    setError('');
    setSubmitting(true);
    try {
      const result = await onSubmit(amount); // resolves to { ok: true } or { ok: false, message }
      if (result?.ok) setValue('');
      else setError(result?.message ?? 'Your bid was not accepted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label htmlFor="bid-amount" className="label">Your bid (₹)</label>
        <div className="flex gap-2">
          <input
            id="bid-amount"
            inputMode="numeric"
            autoComplete="off"
            className="input"
            placeholder={String(minimumNextBid)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled || submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'bid-error' : 'bid-hint'}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={disabled || submitting}>
            {submitting ? 'Placing…' : 'Place bid'}
          </button>
        </div>
        <p id="bid-hint" className="mt-1 text-xs text-ink-muted">
          Minimum next bid {formatCurrency(minimumNextBid)}.{' '}
          <button type="button" className="font-medium text-accent underline-offset-2 hover:underline" onClick={() => setValue(String(minimumNextBid))} disabled={disabled}>
            Use minimum
          </button>
        </p>
        {error && <p id="bid-error" role="alert" className="field-error">{error}</p>}
      </div>
    </form>
  );
}
