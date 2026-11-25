import { PageHero } from '@/components/sections/Hero';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { LegalPageContent } from '@/content/cms/registry';

export function LegalPageView({ content }: { content: LegalPageContent }) {
  return (
    <>
      <PageHero title={content.page.title} lead={content.page.intro} />

      <Section spacing="compact">
        <Container className="flex max-w-3xl flex-col gap-8">
          <p
            role="note"
            className="rounded-card border-s-4 border-status-warning bg-surface p-4 font-semibold"
          >
            <span className="block">{content.draftStatus.label}</span>
            <span className="mt-1 block font-normal leading-relaxed text-text-secondary">
              {content.draftStatus.body}
            </span>
          </p>
          {content.page.sections.map((section) => (
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
