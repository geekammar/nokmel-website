import { CtaBand, PageHero } from '@/components/sections/Hero';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { ContactContent } from '@/content/ar/contact';
import type { PublicChannel } from '@/lib/settings/model';

type ContactChannel = { type: string; label: string; value?: string; href: string };

export function ContactView({
  content,
  channels,
}: {
  content: ContactContent;
  channels?: PublicChannel[];
}) {
  const effectiveChannels: ContactChannel[] =
    channels && channels.length > 0 ? channels : content.channels;
  return (
    <>
      <PageHero title={content.hero.title} lead={content.hero.lead} />

      <Section spacing="compact">
        <Container className="flex flex-col gap-6">
          <h2 className="text-xl font-bold sm:text-2xl">{content.channelsTitle}</h2>
          {effectiveChannels.length > 0 ? (
            <ul className="flex list-none flex-col gap-3 p-0" data-testid="contact-channels">
              {effectiveChannels.map((channel) => (
                <li key={`${channel.type}-${channel.href}`} className="text-base">
                  <a
                    href={channel.href}
                    className="font-medium text-action-secondary underline-offset-4 hover:underline"
                    {...(channel.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {channel.label}
                    {channel.value ? (
                      <span className="ms-2 break-all text-sm text-text-secondary" dir="ltr">
                        {channel.value}
                      </span>
                    ) : null}
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
