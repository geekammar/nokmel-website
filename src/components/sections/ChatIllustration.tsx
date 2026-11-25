import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

const messageLines = [68, 84, 52] as const;

function BubbleLines({ widths }: { widths: readonly number[] }) {
  return (
    <div className="flex flex-col gap-2">
      {widths.map((width, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="block h-2 rounded-full bg-border-subtle"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Conceptual illustration of the product idea: an abstract order conversation.
 * It uses skeleton lines only — no fabricated product UI, content, or data.
 */
export function ChatIllustration({
  badge,
  title,
  body,
  caption,
}: {
  badge: string;
  title: string;
  body: string;
  caption: string;
}) {
  return (
    <Section tone="dark">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
          <p className="max-w-xl leading-relaxed text-text-secondary">{body}</p>
        </div>
        <figure className="flex flex-col gap-4">
          <div
            data-illustration="conceptual"
            className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface p-6 text-text-primary"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                role="note"
                className="rounded-control border border-status-info px-3 py-1 text-xs font-semibold text-status-info"
              >
                {badge}
              </span>
              <span
                aria-hidden="true"
                className="flex h-8 w-24 items-center justify-center rounded-control border border-border-subtle"
              >
                <span className="block h-2 w-12 rounded-full bg-border-subtle" />
              </span>
            </div>
            <div
              data-testid="illustration-bubble"
              className="max-w-[80%] self-start rounded-card border border-border-subtle bg-page p-4"
            >
              <BubbleLines widths={messageLines} />
            </div>
            <div
              data-testid="illustration-bubble"
              className="max-w-[70%] self-end rounded-card bg-action-primary-bg p-4"
              style={{ color: 'var(--action-primary-fg)' }}
            >
              <span
                aria-hidden="true"
                className="block h-2 w-3/5 rounded-full opacity-60"
                style={{ backgroundColor: 'currentColor' }}
              />
            </div>
            <div
              data-testid="illustration-bubble"
              className="flex max-w-[85%] flex-col gap-3 self-start rounded-card border border-border-subtle bg-page p-4"
            >
              <BubbleLines widths={[90, 64]} />
              <span
                aria-hidden="true"
                className="flex h-9 w-28 items-center justify-center rounded-control bg-action-primary-bg"
                style={{ color: 'var(--action-primary-fg)' }}
              >
                <span
                  className="block h-2 w-16 rounded-full opacity-60"
                  style={{ backgroundColor: 'currentColor' }}
                />
              </span>
            </div>
          </div>
          <figcaption className="text-sm leading-relaxed text-text-secondary">{caption}</figcaption>
        </figure>
      </Container>
    </Section>
  );
}
