import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/Hero';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { legal } from '@/content/ar/legal';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'الشروط والأحكام — نكمّل',
  description: legal.terms.intro,
  path: '/terms',
});

export default function TermsPage() {
  return (
    <>
      <PageHero title={legal.terms.title} lead={legal.terms.intro} />

      <Section spacing="compact">
        <Container className="flex max-w-3xl flex-col gap-8">
          <p
            role="note"
            className="rounded-card border-s-4 border-status-warning bg-surface p-4 font-semibold"
          >
            <span className="block">{legal.draftStatus.label}</span>
            <span className="mt-1 block font-normal leading-relaxed text-text-secondary">
              {legal.draftStatus.body}
            </span>
          </p>
          {legal.terms.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h2 className="text-xl font-bold">{section.heading}</h2>
              <p className="leading-relaxed text-text-secondary">{section.body}</p>
            </section>
          ))}
        </Container>
      </Section>
    </>
  );
}
