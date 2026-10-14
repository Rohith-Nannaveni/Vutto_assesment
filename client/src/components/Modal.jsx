import { useEffect, useRef } from 'react';

// Minimal accessible dialog: Esc closes, focus moves inside and returns on close.
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="card w-full max-w-md p-5 outline-none">
        <h2 className="mb-3 text-lg">{title}</h2>
        {children}
      </div>
    </div>
  );
}
