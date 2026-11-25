import type { Metadata } from 'next';
import { CtaBand, PageHero } from '@/components/sections/Hero';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { contact } from '@/content/ar/contact';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'تواصل معنا — نكمّل',
  description: contact.hero.lead,
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageHero title={contact.hero.title} lead={contact.hero.lead} />

      <Section spacing="compact">
        <Container className="flex flex-col gap-6">
          <h2 className="text-xl font-bold sm:text-2xl">{contact.channelsTitle}</h2>
          {contact.channels.length > 0 ? (
            <ul className="flex list-none flex-col gap-3 p-0">
              {contact.channels.map((channel) => (
                <li key={channel.href} className="text-base">
                  <a href={channel.href} className="font-medium text-action-secondary underline-offset-4 hover:underline">
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
              {contact.emptyNote}
            </p>
          )}
        </Container>
      </Section>

      <CtaBand
        title={contact.joinSuggestion.title}
        body={contact.joinSuggestion.body}
        primary={contact.joinSuggestion.primaryCta}
      />
    </>
  );
}
