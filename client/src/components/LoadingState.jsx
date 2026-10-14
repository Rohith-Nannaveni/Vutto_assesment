export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-ink-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-line border-t-accent" aria-hidden="true" />
      {label}
    </div>
  );
}
