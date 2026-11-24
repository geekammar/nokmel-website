import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { StatusBadge } from '@/components/sections/StatusBadge';
import type { CapabilityItem, TextItem } from '@/content/schema';

export function InfoGrid({ items }: { items: readonly TextItem[] }) {
  return (
    <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.title} className="rounded-card border border-border-subtle bg-surface p-6">
          <h3 className="text-lg font-semibold">{item.title}</h3>
          <p className="mt-2 leading-relaxed text-text-secondary">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function CapabilityGrid({ items }: { items: readonly CapabilityItem[] }) {
  return (
    <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li
          key={item.title}
          className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-6"
        >
          <StatusBadge status={item.status} />
          <div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-text-secondary">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function InfoSection({
  title,
  lead,
  items,
  withStatus = false,
  sectionId,
  className = '',
}: {
  title: string;
  lead?: string;
  items: readonly (TextItem | CapabilityItem)[];
  withStatus?: boolean;
  sectionId?: string;
  className?: string;
}) {
  return (
    <Section id={sectionId} className={className}>
      <Container className="flex flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
          {lead ? <p className="leading-relaxed text-text-secondary">{lead}</p> : null}
        </div>
        {withStatus ? <CapabilityGrid items={items as CapabilityItem[]} /> : <InfoGrid items={items} />}
      </Container>
    </Section>
  );
}
