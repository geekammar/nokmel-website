import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { StatusBadge } from '@/components/sections/StatusBadge';
import type { CapabilityItem, TextItem } from '@/content/schema';

/**
 * Problems section: compact editorial rows with marker dots and hairline
 * separators — deliberately not a card grid.
 */
export function ProblemRows({ items }: { items: readonly TextItem[] }) {
  return (
    <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
          <span
            aria-hidden="true"
            className="mt-2.5 block h-2 w-2 shrink-0 rounded-full border border-border-input bg-surface"
          />
          <div>
            <h3 className="text-base font-semibold">{item.title}</h3>
            <p className="mt-1 leading-relaxed text-text-secondary">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Capabilities split by status into two clearly labeled groups; single status
 * badge per group instead of a badge on every item.
 */
export function CapabilityGroups({ items }: { items: readonly CapabilityItem[] }) {
  const current = items.filter((item) => item.status === 'direction');
  const planned = items.filter((item) => item.status === 'planned');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-card border border-border-input bg-surface p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{current[0]?.groupTitle}</h3>
          <StatusBadge status="direction" />
        </div>
        <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
          {current.map((item) => (
            <li key={item.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span aria-hidden="true" className="mt-1 text-status-success">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8.5L6 12.5L14 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <span className="font-semibold">{item.title}</span>
                <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-card border border-border-subtle bg-page p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{planned[0]?.groupTitle}</h3>
          <StatusBadge status="planned" />
        </div>
        <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
          {planned.map((item) => (
            <li key={item.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span aria-hidden="true" className="mt-1.5 block h-2 w-2 shrink-0 rounded-full border border-border-input" />
              <div>
                <span className="font-semibold">{item.title}</span>
                <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Three-step flow: tight numbered nodes in one row, not a card grid.
 */
export function StepsFlow({ steps }: { steps: readonly { title: string; body: string }[] }) {
  return (
    <ol className="grid list-none gap-6 p-0 sm:grid-cols-3 sm:gap-4">
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-action-primary-bg text-lg font-bold text-action-primary-fg"
            >
              {index + 1}
            </span>
            <h3 className="min-w-0 text-base font-semibold leading-snug">{step.title}</h3>
          </div>
          <p className="max-w-xs leading-relaxed text-text-secondary">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
