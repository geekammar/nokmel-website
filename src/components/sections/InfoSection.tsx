import type { CapabilityItem } from '@/content/schema';

export function CapabilityList({ items }: { items: readonly CapabilityItem[] }) {
  return (
    <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
          <span aria-hidden="true" className="mt-0.5 text-status-success">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8.5L6 12.5L14 3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

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
