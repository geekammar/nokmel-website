import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import type { FaqItem, TextItem } from '@/content/schema';

export function StepsSection({
  title,
  note,
  items,
}: {
  title: string;
  note: string;
  items: readonly TextItem[];
}) {
  return (
    <Section id="how-it-works" spacing="compact">
      <Container className="flex flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
          <p role="note" className="text-sm text-text-secondary">
            {note}
          </p>
        </div>
        <ol className="grid list-none gap-4 p-0 sm:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={item.title}
              className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface p-6"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-control border border-border-subtle bg-page text-lg font-bold text-brand-primary"
              >
                {index + 1}
              </span>
              <span className="sr-only">{`الخطوة ${index + 1}`}</span>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="leading-relaxed text-text-secondary">{item.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

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
