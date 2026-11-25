import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { CtaLink } from '@/content/schema';

type ShowcaseStep = {
  title: string;
  body: string;
};

type ConceptShowcaseProps = {
  title: string;
  body: string;
  steps: readonly ShowcaseStep[];
  caption: string;
  cta: CtaLink;
};

/**
 * Conceptual product workflow (Telegram-first): a real conversation leads into
 * an organized order and single-place follow-up. Clearly labeled as a concept
 * — no fabricated UI, customer data, logos, or metrics are shown.
 */
export function ConceptShowcase({ title, body, steps, caption, cta }: ConceptShowcaseProps) {
  return (
    <Section tone="dark">
      <Container className="flex flex-col items-start gap-8">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
          <p className="leading-relaxed text-text-secondary">{body}</p>
        </div>

        <figure className="w-full">
          <div data-theme="light-panel" className="flex flex-col gap-4 rounded-card border border-border-subtle bg-brand-primary p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                role="note"
                className="rounded-control border border-brand-primary bg-surface px-3 py-1 text-xs font-semibold text-brand-primary"
              >
                {caption}
              </span>
              <span
                lang="en"
                dir="ltr"
                aria-hidden="true"
                className="text-xs font-semibold text-brand-highlight"
              >
                Telegram-first
              </span>
            </div>

            <ol className="grid list-none gap-6 p-0 lg:grid-cols-3 lg:gap-4">
              <li className="flex flex-col gap-3">
                <div className="flex-1 rounded-card border border-border-input bg-surface p-4">
                  <span className="mb-2 inline-flex items-center gap-2 rounded-control bg-page px-2.5 py-1 text-xs font-semibold text-status-info">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M14.5 1.5L7 9M14.5 1.5L9.8 14.5L7 9L1.5 6.2L14.5 1.5Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {steps[0].title}
                  </span>
                  <p
                    lang="ar"
                    className="rounded-card bg-page px-3.5 py-2.5 text-sm leading-relaxed text-text-primary"
                  >
                    صباح الخير، متوفر من المنتج الأول؟ محتاج ٢ قطع كرتون تغليف
                  </p>
                  <p className="mt-2 leading-relaxed text-text-secondary">{steps[0].body}</p>
                </div>
              </li>

              <li className="flex flex-col gap-3">
                <div className="flex-1 rounded-card border border-border-input bg-surface p-4">
                  <span className="mb-2 inline-flex items-center gap-2 rounded-control bg-action-primary-bg px-2.5 py-1 text-xs font-semibold text-action-primary-fg">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3 2H13V14L8 11L3 14V2Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {steps[1].title}
                  </span>
                  <div className="flex flex-col gap-2 rounded-card bg-page px-3.5 py-2.5 text-sm text-text-primary">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">المنتج الأول × 2</span>
                      <span className="rounded-control border border-border-input px-2 py-0.5 text-xs text-text-secondary">جديد</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary">طريقة التسليم</span>
                      <span>تيليجرام</span>
                    </div>
                  </div>
                  <p className="mt-2 leading-relaxed text-text-secondary">{steps[1].body}</p>
                </div>
              </li>

              <li className="flex flex-col gap-3">
                <div className="flex-1 rounded-card border border-border-input bg-surface p-4">
                  <span className="mb-2 inline-flex items-center gap-2 rounded-control bg-page px-2.5 py-1 text-xs font-semibold text-status-success">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M2 8.5L6 12.5L14 3.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {steps[2].title}
                  </span>
                  <div className="flex flex-col gap-1.5 rounded-card bg-page px-3.5 py-2.5 text-sm text-text-primary">
                    <span>تأكيد الطلب من المحادثة</span>
                    <span>تحديث الحالة للعميل</span>
                    <span>كل الطلبات في مكان واحد</span>
                  </div>
                  <p className="mt-2 leading-relaxed text-text-secondary">{steps[2].body}</p>
                </div>
              </li>
            </ol>
          </div>
        </figure>

        <Button href={cta.href} size="lg">
          {cta.label}
        </Button>
      </Container>
    </Section>
  );
}
