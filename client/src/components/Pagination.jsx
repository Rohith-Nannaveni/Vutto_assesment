import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total } = meta;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-sm text-ink-muted">Page {page} of {totalPages} · {total} results</p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={14} aria-hidden="true" /> Previous
        </button>
        <button type="button" className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
