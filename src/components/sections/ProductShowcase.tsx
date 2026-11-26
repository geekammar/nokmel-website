'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { CtaLink } from '@/content/schema';

type ShowcaseStep = {
  title: string;
  body: string;
};

export type ShowcaseSide = 'customer' | 'merchant';

export type ShowcaseScene = {
  id: string;
  side: ShowcaseSide;
  phase: 0 | 1 | 2;
  title: string;
  detail: string;
  customer: 'browse' | 'product' | 'cart' | 'review' | 'placed';
  merchant: 'waiting' | 'new' | 'accepted';
};

export const PRODUCT_SHOWCASE_STEP_MS = 2000;

export const PRODUCT_SHOWCASE_SCENES: readonly ShowcaseScene[] = [
  {
    id: 'browse',
    side: 'customer',
    phase: 0,
    title: 'تصفح المنتجات داخل المحادثة',
    detail:
      'يفتح العميل متجر تيليجرام ويستعرض المنتجات كأزرار واضحة داخل المحادثة.',
    customer: 'browse',
    merchant: 'waiting',
  },
  {
    id: 'select',
    side: 'customer',
    phase: 0,
    title: 'اختيار المنتج والكمية',
    detail:
      'يفتح العميل المنتج ويختار الكمية من أزرار جاهزة قبل الإضافة إلى السلة.',
    customer: 'product',
    merchant: 'waiting',
  },
  {
    id: 'cart',
    side: 'customer',
    phase: 0,
    title: 'إضافة المنتج إلى السلة',
    detail: 'تظهر السلة بالمنتج والكمية والمجموع، مع زر إتمام الطلب.',
    customer: 'cart',
    merchant: 'waiting',
  },
  {
    id: 'checkout',
    side: 'customer',
    phase: 1,
    title: 'إتمام الطلب وجمع بيانات التوصيل',
    detail:
      'يراجع العميل بيانات الاسم والهاتف والعنوان، ثم يختار الدفع عند الاستلام.',
    customer: 'review',
    merchant: 'waiting',
  },
  {
    id: 'placed',
    side: 'customer',
    phase: 1,
    title: 'تسجيل الطلب ووصوله إلى المتجر',
    detail:
      'يظهر مرجع الطلب للعميل، وينتقل الطلب نفسه إلى لوحة إدارة الطلبات.',
    customer: 'placed',
    merchant: 'waiting',
  },
  {
    id: 'merchant-new',
    side: 'merchant',
    phase: 2,
    title: 'ظهور الطلب في إدارة المتجر',
    detail:
      'يظهر الطلب الجديد في لوحة الطلبات بالحالة «تم الطلب» مع الإجراء التالي «قبول الطلب».',
    customer: 'placed',
    merchant: 'new',
  },
  {
    id: 'merchant-accept',
    side: 'merchant',
    phase: 2,
    title: 'قبول الطلب من لوحة المتجر',
    detail:
      'يقبل التاجر الطلب فتتغير حالته إلى «مقبول» ويصبح الإجراء التالي «بدء التجهيز».',
    customer: 'placed',
    merchant: 'accepted',
  },
];

const controlClass =
  'inline-flex min-h-control items-center justify-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50';

function PanelHeader({
  label,
  caption,
  tone,
}: {
  label: string;
  caption: string;
  tone: 'customer' | 'merchant';
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 items-center justify-center rounded-control text-xs font-bold ${
            tone === 'customer'
              ? 'bg-action-primary-bg text-action-primary-fg'
              : 'bg-brand-highlight text-brand-primary'
          }`}
        >
          {tone === 'customer' ? 'ع' : 'ت'}
        </span>
        <div>
          <p className="text-sm font-bold text-text-primary">{label}</p>
          <p className="text-xs text-text-secondary">{caption}</p>
        </div>
      </div>
      <span className="rounded-control border border-border-subtle px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
        بيانات اصطناعية
      </span>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[94%] self-start rounded-card border border-border-subtle bg-page px-3.5 py-3 text-sm text-text-primary">
      {children}
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[80%] self-end rounded-card bg-action-primary-bg px-3.5 py-2.5 text-sm text-action-primary-fg">
      {children}
    </div>
  );
}

function FakeButton({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`flex min-h-9 items-center justify-center rounded-control border px-3 py-1.5 text-xs font-semibold ${
        active
          ? 'border-action-secondary bg-action-secondary text-action-primary-fg'
          : 'border-border-input bg-surface text-text-primary'
      }`}
    >
      {children}
    </span>
  );
}

function OrderSummary({ compact = false }: { compact?: boolean }) {
  return (
    <dl className={`grid gap-1.5 text-xs ${compact ? '' : 'mt-2'}`}>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-text-secondary">المجموع الفرعي</dt>
        <dd className="font-semibold" dir="ltr">
          50.00 ر.س
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-text-secondary">رسوم التوصيل</dt>
        <dd className="font-semibold" dir="ltr">
          10.00 ر.س
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-1.5">
        <dt className="font-semibold text-text-primary">الإجمالي</dt>
        <dd className="font-bold text-text-primary" dir="ltr">
          60.00 ر.س
        </dd>
      </div>
    </dl>
  );
}

function CustomerConversation({ state }: { state: ShowcaseScene['customer'] }) {
  if (state === 'browse') {
    return (
      <>
        <BotBubble>
          <p>أهلاً بك في متجر تجريبي 👋</p>
          <p className="mt-1 text-xs text-text-secondary">اختر منتجاً للبدء:</p>
          <div className="mt-2 grid gap-1.5">
            <FakeButton>عبوة تغليف كرتونية · 25.00 ر.س</FakeButton>
            <FakeButton>ملصقات متجر مخصصة · 40.00 ر.س</FakeButton>
            <FakeButton>دفتر طلبات صغير · 15.00 ر.س</FakeButton>
          </div>
        </BotBubble>
      </>
    );
  }

  if (state === 'product') {
    return (
      <>
        <BotBubble>
          <p className="font-bold">عبوة تغليف كرتونية</p>
          <p className="mt-1 text-xs text-text-secondary">
            25.00 ر.س · متوفر للطلب
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <FakeButton active>إضافة 1</FakeButton>
            <FakeButton>إضافة 2</FakeButton>
            <FakeButton>إضافة 3</FakeButton>
          </div>
          <div className="mt-2">
            <FakeButton>السلة</FakeButton>
          </div>
        </BotBubble>
        <UserBubble>أضف قطعتين</UserBubble>
      </>
    );
  }

  if (state === 'cart') {
    return (
      <BotBubble>
        <p className="font-bold">سلتك</p>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface px-3 py-2">
          <span>عبوة تغليف كرتونية × 2</span>
          <span className="text-xs font-semibold" dir="ltr">
            50.00 ر.س
          </span>
        </div>
        <OrderSummary />
        <div className="mt-3">
          <FakeButton active>إتمام الطلب</FakeButton>
        </div>
      </BotBubble>
    );
  }

  if (state === 'review') {
    return (
      <BotBubble>
        <p className="font-bold">راجع طلبك</p>
        <dl className="mt-2 grid gap-1 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">الاسم</dt>
            <dd>عميل تجريبي</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">الهاتف</dt>
            <dd dir="ltr">•••• 1234</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">العنوان</dt>
            <dd>عنوان تجريبي</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-secondary">الدفع</dt>
            <dd>عند الاستلام</dd>
          </div>
        </dl>
        <OrderSummary />
        <div className="mt-3">
          <FakeButton active>تأكيد الطلب — الدفع عند الاستلام</FakeButton>
        </div>
      </BotBubble>
    );
  }

  return (
    <>
      <BotBubble>
        <p className="font-bold text-status-success">تم تسجيل الطلب</p>
        <p className="mt-1">
          مرجع الطلب:{' '}
          <span className="font-semibold" dir="ltr" data-testid="showcase-customer-order">
            NW-1042
          </span>
        </p>
        <OrderSummary />
        <p className="mt-2 text-xs font-semibold text-text-primary">
          الدفع عند الاستلام — بانتظار التحصيل
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          تم حجز المنتجات لهذا الطلب في المتجر.
        </p>
      </BotBubble>
    </>
  );
}

function MerchantOrders({ state }: { state: ShowcaseScene['merchant'] }) {
  if (state === 'waiting') {
    return (
      <div className="flex min-h-[15rem] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle bg-page px-4 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-control border border-border-subtle bg-surface text-lg font-bold text-text-secondary"
        >
          ٠
        </span>
        <p className="font-semibold text-text-primary">لا طلبات جديدة بعد</p>
        <p className="max-w-xs text-xs leading-5 text-text-secondary">
          سيظهر الطلب التجريبي هنا بعد إتمامه من المحادثة.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border-subtle bg-page p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-text-primary">
          <span dir="ltr" data-testid="showcase-merchant-order">
            NW-1042
          </span>
        </p>
        <span
          data-testid="showcase-merchant-status"
          className={`rounded-control border px-2 py-0.5 text-xs font-semibold ${
            state === 'new'
              ? 'border-status-info bg-surface text-status-info'
              : 'border-status-success bg-surface text-status-success'
          }`}
        >
          {state === 'new' ? 'تم الطلب' : 'مقبول'}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm">
        <span>عبوة تغليف كرتونية × 2</span>
        <span className="text-xs font-semibold" dir="ltr">
          60.00 ر.س
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-text-secondary">الدفع عند الاستلام</span>
        <span className="text-text-secondary">عميل تجريبي</span>
      </div>
      <div className="mt-3 rounded-control border border-border-subtle bg-surface p-2.5">
        <p className="text-[11px] font-semibold text-text-secondary">
          الإجراء التالي
        </p>
        <div className="mt-1.5">
          <FakeButton active>
            {state === 'new' ? 'قبول الطلب' : 'بدء التجهيز'}
          </FakeButton>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        {state === 'new'
          ? 'نفس مرجع الطلب الظاهر في المحادثة.'
          : 'تم قبول الطلب. الإجراء التالي المتاح هو بدء التجهيز.'}
      </p>
    </div>
  );
}

export function ProductShowcase({
  title,
  body,
  steps,
  caption,
  cta,
}: {
  title: string;
  body: string;
  steps: readonly ShowcaseStep[];
  caption: string;
  cta: CtaLink;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeSide, setActiveSide] = useState<ShowcaseSide>('customer');
  const [reducedMotion, setReducedMotion] = useState(false);
  const scene = PRODUCT_SHOWCASE_SCENES[index];
  const lastIndex = PRODUCT_SHOWCASE_SCENES.length - 1;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setActiveSide(PRODUCT_SHOWCASE_SCENES[index].side);
  }, [index]);

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setIndex((current) => Math.min(current + 1, lastIndex));
    }, PRODUCT_SHOWCASE_STEP_MS);
    return () => window.clearTimeout(timeout);
  }, [index, lastIndex, playing]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  function goTo(next: number) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(next, lastIndex)));
  }

  function toggleAutoplay() {
    if (reducedMotion) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (index >= lastIndex) setIndex(0);
    setPlaying(true);
  }

  const customerPanelClass =
    activeSide === 'customer' ? 'block' : 'hidden lg:block';
  const merchantPanelClass =
    activeSide === 'merchant' ? 'block' : 'hidden lg:block';

  return (
    <Section id="product-showcase" tone="dark">
      <Container className="flex flex-col gap-7">
        <div className="flex max-w-3xl flex-col gap-3">
          <span className="w-fit rounded-control border border-brand-highlight px-3 py-1 text-xs font-semibold text-brand-highlight">
            عرض تفاعلي ببيانات اصطناعية
          </span>
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          <p className="leading-relaxed text-text-secondary">{body}</p>
        </div>

        <div
          data-testid="product-showcase"
          className="rounded-card border border-border-subtle bg-brand-primary p-2 sm:p-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5 lg:hidden" role="group" aria-label="اختيار واجهة العرض">
              <button
                type="button"
                onClick={() => setActiveSide('customer')}
                aria-pressed={activeSide === 'customer'}
                data-testid="showcase-mobile-customer"
                className={`min-h-control rounded-control px-3 text-xs font-semibold ${
                  activeSide === 'customer'
                    ? 'bg-action-primary-bg text-action-primary-fg'
                    : 'border border-border-interactive text-text-primary'
                }`}
              >
                واجهة العميل
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('merchant')}
                aria-pressed={activeSide === 'merchant'}
                data-testid="showcase-mobile-merchant"
                className={`min-h-control rounded-control px-3 text-xs font-semibold ${
                  activeSide === 'merchant'
                    ? 'bg-action-primary-bg text-action-primary-fg'
                    : 'border border-border-interactive text-text-primary'
                }`}
              >
                إدارة الطلبات
              </button>
            </div>
            <p className="ms-auto text-xs font-semibold text-text-secondary">
              الخطوة <span dir="ltr">{index + 1}</span> من{' '}
              <span dir="ltr">{PRODUCT_SHOWCASE_SCENES.length}</span>
            </p>
          </div>

          <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr]">
            <div
              data-testid="showcase-customer-panel"
              data-theme="light-panel"
              className={`${customerPanelClass} rounded-card border border-border-subtle bg-surface text-text-primary shadow-sm ${
                activeSide === 'customer' ? 'ring-2 ring-brand-highlight' : ''
              }`}
            >
              <PanelHeader
                label="محادثة المتجر"
                caption="رحلة العميل داخل تيليجرام"
                tone="customer"
              />
              <div aria-hidden="true" className="flex min-h-[18rem] flex-col gap-2 px-3 py-3">
                <CustomerConversation state={scene.customer} />
              </div>
              <p className="border-t border-border-subtle px-4 py-2.5 text-xs leading-5 text-text-secondary">
                لا يتم إرسال أي طلب أو بيانات من هذا العرض.
              </p>
            </div>

            <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="h-16 w-px bg-border-subtle" />
                <span className="rounded-control border border-brand-highlight px-2.5 py-1 text-[11px] font-semibold text-brand-highlight">
                  نفس الطلب
                </span>
                <span className="text-lg text-brand-highlight">←</span>
                <span className="h-16 w-px bg-border-subtle" />
              </div>
            </div>

            <div
              data-testid="showcase-merchant-panel"
              data-theme="light-panel"
              className={`${merchantPanelClass} rounded-card border border-border-subtle bg-surface text-text-primary shadow-sm ${
                activeSide === 'merchant' ? 'ring-2 ring-brand-highlight' : ''
              }`}
            >
              <PanelHeader
                label="إدارة الطلبات"
                caption="لوحة التاجر"
                tone="merchant"
              />
              <div aria-hidden="true" className="min-h-[18rem] px-3 py-3">
                <MerchantOrders state={scene.merchant} />
              </div>
              <p className="border-t border-border-subtle px-4 py-2.5 text-xs leading-5 text-text-secondary">
                الحالات والإجراءات المعروضة ضمن سلوك الطلبات المدعوم في تطبيق التاجر.
              </p>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="sr-only" data-testid="showcase-live">
          الخطوة {index + 1} من {PRODUCT_SHOWCASE_SCENES.length}: {scene.title}.{' '}
          {scene.detail}
        </p>

        <div className="rounded-card border border-border-subtle bg-brand-primary p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <p className="font-bold text-text-primary" data-testid="showcase-step-title">
                {scene.title}
              </p>
              <p
                className="mt-1 text-sm leading-6 text-text-secondary"
                data-testid="showcase-step-detail"
              >
                {scene.detail}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className={controlClass}
                data-testid="showcase-prev"
              >
                السابق
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                disabled={index === lastIndex}
                className="inline-flex min-h-control items-center justify-center rounded-control bg-action-primary-bg px-4 text-sm font-semibold text-action-primary-fg hover:bg-action-primary-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="showcase-next"
              >
                التالي
              </button>
              <button
                type="button"
                onClick={() => goTo(0)}
                className={controlClass}
                data-testid="showcase-replay"
              >
                إعادة العرض
              </button>
              <button
                type="button"
                onClick={toggleAutoplay}
                disabled={reducedMotion}
                className={controlClass}
                data-testid="showcase-autoplay"
              >
                {playing ? 'إيقاف مؤقت' : 'تشغيل تلقائي'}
              </button>
            </div>
          </div>
          {reducedMotion ? (
            <p className="mt-2 text-xs leading-5 text-brand-highlight" data-testid="showcase-reduced-note">
              التشغيل التلقائي معطّل احتراماً لتفضيل تقليل الحركة في جهازك.
            </p>
          ) : null}
        </div>

        <ol className="grid list-none gap-3 p-0 sm:grid-cols-3">
          {steps.map((step, stepIndex) => {
            const active = scene.phase === stepIndex;
            return (
              <li
                key={step.title}
                aria-current={active ? 'step' : undefined}
                className={`flex gap-3 rounded-card border p-3 ${
                  active
                    ? 'border-brand-highlight bg-brand-primary'
                    : 'border-border-subtle'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-xs font-bold ${
                    active
                      ? 'bg-brand-highlight text-brand-primary'
                      : 'border border-border-input text-text-secondary'
                  }`}
                >
                  {stepIndex + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-2xl flex-col gap-1">
            <p className="text-xs font-semibold text-brand-highlight">{caption}</p>
            <p className="text-xs leading-5 text-text-secondary">
              عرض توضيحي ببيانات اصطناعية — لا يُنشئ طلباً حقيقياً ولا يُرسل بيانات،
              ولا يمثل واجهة المتجر النهائية.
            </p>
          </div>
          <Button href={cta.href} size="lg">
            {cta.label}
          </Button>
        </div>
      </Container>
    </Section>
  );
}
