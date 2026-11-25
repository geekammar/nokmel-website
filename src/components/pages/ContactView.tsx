import { CtaBand, PageHero } from '@/components/sections/Hero';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { ContactContent } from '@/content/ar/contact';

export function ContactView({ content }: { content: ContactContent }) {
  return (
    <>
      <PageHero title={content.hero.title} lead={content.hero.lead} />

      <Section spacing="compact">
        <Container className="flex flex-col gap-6">
          <h2 className="text-xl font-bold sm:text-2xl">{content.channelsTitle}</h2>
          {content.channels.length > 0 ? (
            <ul className="flex list-none flex-col gap-3 p-0">
              {content.channels.map((channel) => (
                <li key={channel.href} className="text-base">
                  <a
                    href={channel.href}
                    className="font-medium text-action-secondary underline-offset-4 hover:underline"
                  >
                    {channel.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p
              role="note"
              className="max-w-2xl rounded-card border-s-4 border-status-warning bg-surface p-4 leading-relaxed text-text-secondary"
            >
              {content.emptyNote}
            </p>
          )}
        </Container>
      </Section>

      <CtaBand
        title={content.joinSuggestion.title}
        body={content.joinSuggestion.body}
        primary={content.joinSuggestion.primaryCta}
      />
    </>
  );
}
