export default function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-lg border border-dashed border-surface-line bg-white px-6 py-12 text-center">
      <h3 className="text-base">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
