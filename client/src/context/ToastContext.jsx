import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback((message, { type = 'info', duration = 7000 } = {}) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    if (duration) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);

  const tone = { info: 'border-surface-line', success: 'border-green-300', warning: 'border-amber-400', error: 'border-red-300' };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-md border bg-white p-3 text-sm shadow-lg ${tone[t.type]}`}>
            <p className="flex-1">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-ink-faint hover:text-ink">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
