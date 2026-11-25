import type { CapabilityStatus } from '@/content/schema';

const statusLabels: Record<CapabilityStatus, string> = {
  available: 'متاحة ومؤكدة',
  direction: 'اتجاه المنتج',
  planned: 'مخطط مستقبلاً',
};

const statusClasses: Record<CapabilityStatus, string> = {
  available: 'border-status-success text-status-success',
  direction: 'border-status-info text-status-info',
  planned: 'border-border-subtle text-text-secondary',
};

export function StatusBadge({ status }: { status: CapabilityStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-control border px-3 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
