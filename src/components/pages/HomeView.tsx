import { FaqSection } from '@/components/sections/Faq';
import { CtaBand } from '@/components/sections/Hero';
import { StepsFlow } from '@/components/sections/InfoSection';
import { ProductShowcase } from '@/components/sections/ProductShowcase';
import { StatusBadge } from '@/components/sections/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import type { HomeContent } from '@/content/ar/home';

function ProblemColumn({ content }: { content: HomeContent['problems'] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex max-w-xl flex-col gap-2">
        <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
        <p className="leading-relaxed text-text-secondary">{content.lead}</p>
      </div>
      <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
        {content.items.map((item, index) => (
          <li key={item.title} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
            <span
              aria-hidden="true"
              className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle text-xs font-semibold text-text-secondary"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CapabilityColumn({ content }: { content: HomeContent['capabilities'] }) {
  const current = content.items.filter((item) => item.status === 'direction');
  const planned = content.items.filter((item) => item.status === 'planned');
  return (
    <div className="flex flex-col gap-5 lg:border-s lg:border-border-subtle lg:ps-10">
      <div className="flex max-w-xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
          <StatusBadge status="direction" />
        </div>
        <p className="leading-relaxed text-text-secondary">{content.lead}</p>
      </div>
      <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
        {current.map((item) => (
          <li key={item.title} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
            <span aria-hidden="true" className="mt-0.5 text-status-success">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 8.5L6 12.5L14 3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {planned.length > 0 ? (
        <div className="rounded-card bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{planned[0]?.groupTitle}</h3>
            <StatusBadge status="planned" />
          </div>
          <ul className="mt-3 grid list-none gap-3 p-0 text-sm sm:grid-cols-2">
            {planned.map((item) => (
              <li key={item.title} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full border border-border-input"
                />
                <span>
                  <span className="block font-semibold text-text-primary">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-text-secondary">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function HomeView({ content }: { content: HomeContent }) {
  const heroSecondaryHref =
    !content.showcase.visible && content.hero.secondaryCta.href === '#product-showcase'
      ? '#how-it-works'
      : content.hero.secondaryCta.href;
  return (
    <>
      <Section className="!pt-10 sm:!pt-14 lg:!pt-20" spacing="compact">
        <Container className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex flex-col items-start gap-5">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-action-secondary" />
              <p className="text-sm font-semibold text-action-secondary">
                {content.hero.eyebrow}
              </p>
            </div>
            <h1 className="max-w-3xl text-3xl font-bold leading-[1.18] sm:text-4xl lg:text-5xl xl:text-6xl">
              {content.hero.headline}
            </h1>
            <p className="text-xl font-semibold text-action-secondary sm:text-2xl">
              {content.hero.tagline}
            </p>
            <p className="max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
              {content.hero.subheadline}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button href={content.hero.primaryCta.href} size="lg">
                {content.hero.primaryCta.label}
              </Button>
              <TextLink href={heroSecondaryHref}>
                {content.hero.secondaryCta.label}
              </TextLink>
            </div>
            <p className="text-sm text-text-secondary">
              الانضمام المبكر لا يتضمن دفعاً أو اشتراكاً في هذه المرحلة.
            </p>
          </div>

          <div className="hidden flex-col items-center gap-4 border-s border-border-subtle ps-10 text-center lg:flex">
            <span className="text-xs font-semibold tracking-wide text-text-secondary">
              تيليجرام أولاً
            </span>
            <img
              src="/brand/logos/nokmel-mark-primary-color.svg"
              alt=""
              aria-hidden="true"
              width={192}
              height={147}
              className="w-40"
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">محادثة ← طلب منظّم ← متابعة</p>
              <p className="text-xs leading-5 text-text-secondary">
                من أول رسالة إلى متابعة الطلب من مكان واحد.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {content.showcase.visible ? (
        <ProductShowcase
          title={content.showcase.title}
          body={content.showcase.body}
          steps={content.showcase.steps}
          caption={content.showcase.caption}
          cta={content.showcase.primaryCta}
        />
      ) : null}

      <Section spacing="compact">
        <Container className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <ProblemColumn content={content.problems} />
          <CapabilityColumn content={content.capabilities} />
        </Container>
      </Section>

      <Section id="how-it-works" spacing="compact" className="border-y border-border-subtle">
        <Container className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="flex flex-col gap-6">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-bold sm:text-3xl">{content.steps.title}</h2>
              <p className="text-sm leading-relaxed text-text-secondary">{content.steps.note}</p>
            </div>
            <StepsFlow steps={content.steps.items} />
          </div>

          <aside
            data-theme="dark"
            className="flex flex-col gap-4 rounded-card bg-page p-6 text-text-primary sm:p-7"
          >
            <h2 className="text-xl font-bold sm:text-2xl">{content.pricingTeaser.title}</h2>
            <p className="leading-relaxed text-text-secondary">{content.pricingTeaser.body}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Button href={content.pricingTeaser.primaryCta.href} size="lg">
                {content.pricingTeaser.primaryCta.label}
              </Button>
              <a
                href={content.pricingTeaser.secondaryCta.href}
                className="font-medium text-brand-highlight underline underline-offset-4 hover:no-underline"
              >
                {content.pricingTeaser.secondaryCta.label}
              </a>
            </div>
            <p className="text-xs leading-5 text-text-secondary">
              ستصلك تفاصيل الخطوة التالية بعد مراجعة طلب الانضمام.
            </p>
          </aside>
        </Container>
      </Section>

      <FaqSection title={content.faq.title} items={content.faq.items} />

      <CtaBand
        title={content.finalCta.title}
        body={content.finalCta.body}
        primary={content.finalCta.primaryCta}
        secondary={content.finalCta.secondaryCta}
      />
    </>
  );
}
