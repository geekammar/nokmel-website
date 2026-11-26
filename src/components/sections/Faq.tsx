import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import type { FaqItem } from '@/content/schema';

export function FaqSection({ title, items }: { title: string; items: readonly FaqItem[] }) {
  return (
    <Section id="faq" spacing="compact">
      <Container className="flex max-w-3xl flex-col gap-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <div className="divide-y divide-border-subtle border-y border-border-subtle">
          {items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex min-h-control cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold marker:content-['']">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl font-normal text-text-secondary transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 leading-relaxed text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
        <p className="text-sm text-text-secondary">
          لم تجد إجابتك؟ <TextLink href="/contact">تواصل معنا</TextLink> أو{' '}
          <TextLink href="/join">اطلب الانضمام</TextLink>.
        </p>
      </Container>
    </Section>
  );
}
