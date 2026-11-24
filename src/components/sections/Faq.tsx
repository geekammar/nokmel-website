import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import type { FaqItem } from '@/content/schema';

export function FaqSection({ title, items }: { title: string; items: readonly FaqItem[] }) {
  return (
    <Section id="faq">
      <Container className="flex max-w-3xl flex-col gap-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <details key={item.question} className="rounded-card border border-border-subtle bg-surface">
              <summary className="flex min-h-control cursor-pointer items-center justify-between gap-4 px-5 py-3 font-semibold marker:content-['']">
                {item.question}
                <span aria-hidden="true" className="text-text-secondary">
                  ▾
                </span>
              </summary>
              <p className="border-t border-border-subtle px-5 py-4 leading-relaxed text-text-secondary">
                {item.answer}
              </p>
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
