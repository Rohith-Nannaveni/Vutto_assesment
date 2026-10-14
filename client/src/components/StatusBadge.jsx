import { STATUS_LABELS } from '../utils/format.js';

const STYLES = {
  active: 'bg-green-50 text-green-800 border-green-200',
  scheduled: 'bg-blue-50 text-blue-800 border-blue-200',
  ended: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  cancelled: 'bg-red-50 text-red-800 border-red-200',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? STYLES.ended}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
