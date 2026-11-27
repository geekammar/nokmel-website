import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { HomeContent } from '@/content/ar/home';

const benefitIcons = [
  <svg key="chat" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
    <path
      d="M5.5 6.5h13a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H11l-4 3v-3H5.5A1.5 1.5 0 0 1 4 15V8a1.5 1.5 0 0 1 1.5-1.5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M8 10.5h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>,
  <svg key="catalog" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
    <path
      d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M5 7.5 12 11l7-3.5M12 11v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="m9 5.8 7 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>,
  <svg key="orders" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
    <rect x="4.5" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 9h8M8 12.5h8M8 16h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>,
  <svg key="follow-up" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
    <rect x="7.5" y="3.5" width="9" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 6h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="m9.5 12.5 1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
] as const;

export function BenefitsGrid({
  content,
}: {
  content: HomeContent['capabilities'];
}) {
  const items = content.items.filter((item) => item.status === 'direction').slice(0, 4);

  return (
    <Section tone="surface" spacing="compact">
      <Container>
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
          <p className="leading-relaxed text-text-secondary">{content.lead}</p>
        </div>

        <ul className="mt-7 grid list-none grid-cols-1 gap-3 p-0 min-[380px]:grid-cols-2 sm:gap-4 lg:mt-9 lg:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.title}
              data-testid="benefit-card"
              className="flex flex-col rounded-card border border-border-subtle bg-page p-5 transition-[border-color,box-shadow] duration-150 lg:hover:border-action-secondary lg:hover:shadow-[0_14px_34px_-30px_rgba(25,43,80,0.6)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-surface text-action-secondary">
                <span className="block h-6 w-6">{benefitIcons[index] ?? benefitIcons[0]}</span>
              </span>
              <h3 className="mt-4 text-base font-bold leading-snug">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-text-secondary">{item.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
