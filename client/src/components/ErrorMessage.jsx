import { AlertCircle } from 'lucide-react';

export default function ErrorMessage({ error, onRetry, className = '' }) {
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return null;
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 ${className}`}>
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1">{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Try again</button>}
    </div>
  );
}
