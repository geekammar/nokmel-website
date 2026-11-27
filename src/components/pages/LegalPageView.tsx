import { PageHero } from '@/components/sections/Hero';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { publicJoinUi } from '@/content/ar/join-request';
import type { LegalPageContent } from '@/content/cms/registry';

export function LegalPageView({
  content,
  intakeEnabled = false,
}: {
  content: LegalPageContent;
  intakeEnabled?: boolean;
}) {
  return (
    <>
      <PageHero title={content.page.title} lead={content.page.intro} />

      <Section spacing="compact">
        <Container className="flex max-w-2xl flex-col gap-7">
          <p
            role="note"
            className="rounded-card border-s-4 border-status-warning bg-surface p-4 text-sm font-semibold"
          >
            <span className="block">{content.draftStatus.label}</span>
            <span className="mt-1 block font-normal leading-relaxed text-text-secondary">
              {content.draftStatus.body}
            </span>
          </p>
          {intakeEnabled ? (
            <p
              role="note"
              data-testid="privacy-intake-operational-note"
              className="rounded-card border-s-4 border-status-info bg-surface p-4 text-sm leading-relaxed text-text-secondary"
            >
              <span className="block font-semibold text-text-primary">
                {publicJoinUi.privacyOperationalTitle}
              </span>
              <span className="mt-1 block">{publicJoinUi.privacyOperationalBody}</span>
            </p>
          ) : null}
          {content.page.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2 border-t border-border-subtle pt-6 first:border-t-0 first:pt-0">
              <h2 className="text-xl font-bold">{section.heading}</h2>
              <p className="leading-relaxed text-text-secondary">{section.body}</p>
            </section>
          ))}
        </Container>
      </Section>
    </>
  );
}
