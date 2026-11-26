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
export const PRODUCT_SHOWCASE_QUANTITY = 2;
export const PRODUCT_SHOWCASE_ORDER_REFERENCE = 'NW-1042';

export const PRODUCT_SHOWCASE_PRICES = {
  unitMinor: 2500,
  quantity: PRODUCT_SHOWCASE_QUANTITY,
  subtotalMinor: 2500 * PRODUCT_SHOWCASE_QUANTITY,
  deliveryMinor: 1000,
  totalMinor: 2500 * PRODUCT_SHOWCASE_QUANTITY + 1000,
} as const;

export function formatShowcaseMoney(minor: number): string {
  return `${(minor / 100).toFixed(2)} ر.س`;
}

export const PRODUCT_SHOWCASE_SCENES: readonly ShowcaseScene[] = [
  {
    id: 'browse',
    side: 'customer',
    phase: 0,
    title: 'تصفح المنتجات داخل المحادثة',
    detail: 'اضغط زر المنتج التجريبي للبدء.',
    customer: 'browse',
    merchant: 'waiting',
  },
  {
    id: 'select',
    side: 'customer',
    phase: 0,
    title: 'اختيار المنتج والكمية',
    detail: 'اضغط زر إضافة قطعتين لاختيار الكمية وإضافتها إلى السلة.',
    customer: 'product',
    merchant: 'waiting',
  },
  {
    id: 'cart',
    side: 'customer',
    phase: 0,
    title: 'إضافة المنتج إلى السلة',
    detail: 'راجع السلة والكمية والمجموع، ثم ابدأ إتمام الطلب.',
    customer: 'cart',
    merchant: 'waiting',
  },
  {
    id: 'checkout',
    side: 'customer',
    phase: 1,
    title: 'إتمام الطلب وجمع بيانات التوصيل',
    detail: 'راجع بيانات التوصيل وأكّد الطلب بالدفع عند الاستلام.',
    customer: 'review',
    merchant: 'waiting',
  },
  {
    id: 'placed',
    side: 'customer',
    phase: 1,
    title: 'تسجيل الطلب ووصوله إلى المتجر',
    detail: 'افتح إدارة الطلبات لمتابعة نفس الطلب التجريبي.',
    customer: 'placed',
    merchant: 'waiting',
  },
  {
    id: 'merchant-new',
    side: 'merchant',
    phase: 2,
    title: 'ظهور الطلب في إدارة المتجر',
    detail: 'يظهر الطلب الجديد بالحالة «تم الطلب» مع الإجراء التالي «قبول الطلب».',
    customer: 'placed',
    merchant: 'new',
  },
  {
    id: 'merchant-accept',
    side: 'merchant',
    phase: 2,
    title: 'قبول الطلب من لوحة المتجر',
    detail: 'تم قبول الطلب، وأصبح الإجراء التالي المتاح هو بدء التجهيز.',
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
    <div className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2.5">
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-xs font-bold ${
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
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[94%] self-start rounded-card border border-border-subtle bg-page px-3 py-2.5 text-sm text-text-primary">
      {children}
    </div>
  );
}

function ActionButton({
  label,
  ariaLabel,
  testId,
  onClick,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className="flex min-h-control w-full items-center justify-center rounded-control bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold leading-5 text-action-primary-fg hover:bg-action-primary-bg-hover"
    >
      {label}
    </button>
  );
}

function PriceLine({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="font-semibold" dir="ltr" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function OrderSummary() {
  const prices = PRODUCT_SHOWCASE_PRICES;
  return (
    <dl className="mt-2 grid gap-1.5 text-xs">
      <PriceLine
        label="المجموع الفرعي"
        value={formatShowcaseMoney(prices.subtotalMinor)}
        testId="showcase-subtotal"
      />
      <PriceLine
        label="رسوم التوصيل"
        value={formatShowcaseMoney(prices.deliveryMinor)}
        testId="showcase-delivery-fee"
      />
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-1.5">
        <dt className="font-semibold text-text-primary">الإجمالي</dt>
        <dd className="font-bold text-text-primary" dir="ltr" data-testid="showcase-total">
          {formatShowcaseMoney(prices.totalMinor)}
        </dd>
      </div>
    </dl>
  );
}

function CustomerConversation({
  state,
  onAdvance,
  canAdvance,
}: {
  state: ShowcaseScene['customer'];
  onAdvance: () => void;
  canAdvance: boolean;
}) {
  const prices = PRODUCT_SHOWCASE_PRICES;
  const unit = formatShowcaseMoney(prices.unitMinor);
  const subtotal = formatShowcaseMoney(prices.subtotalMinor);

  if (state === 'browse') {
    return (
      <BotBubble>
        <p>أهلاً بك في متجر تجريبي 👋</p>
        <p className="mt-1 text-xs text-text-secondary">اختر المنتج التجريبي للبدء:</p>
        <div className="mt-2">
          <ActionButton
            label={`عبوة تغليف كرتونية · ${unit}`}
            ariaLabel="اختيار المنتج التجريبي: عبوة تغليف كرتونية"
            testId="showcase-action-product"
            onClick={onAdvance}
          />
        </div>
      </BotBubble>
    );
  }

  if (state === 'product') {
    return (
      <BotBubble>
        <p className="font-bold">عبوة تغليف كرتونية</p>
        <p className="mt-1 text-xs text-text-secondary">{unit} · متوفر للطلب</p>
        <p className="mt-2 text-xs font-semibold text-text-primary">
          الكمية المحددة: قطعتان
        </p>
        <div className="mt-2">
          <ActionButton
            label="إضافة قطعتين إلى السلة"
            ariaLabel="إضافة قطعتين من عبوة تغليف كرتونية إلى السلة"
            testId="showcase-action-quantity"
            onClick={onAdvance}
          />
        </div>
      </BotBubble>
    );
  }

  if (state === 'cart') {
    return (
      <BotBubble>
        <p className="font-bold">سلتك</p>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface px-3 py-2">
          <span>عبوة تغليف كرتونية × 2</span>
          <span className="text-xs font-semibold" dir="ltr" data-testid="showcase-cart-line-total">
            {subtotal}
          </span>
        </div>
        <OrderSummary />
        <div className="mt-2.5">
          <ActionButton
            label="إتمام الطلب"
            ariaLabel="بدء إتمام الطلب التجريبي"
            testId="showcase-action-checkout"
            onClick={onAdvance}
          />
        </div>
      </BotBubble>
    );
  }

  if (state === 'review') {
    return (
      <BotBubble>
        <p className="font-bold">راجع طلبك</p>
        <dl className="mt-2 grid gap-1 text-xs">
          <DetailLine label="الاسم" value="عميل تجريبي" />
          <DetailLine label="الهاتف" value="•••• 1234" />
          <DetailLine label="العنوان" value="عنوان تجريبي" />
          <DetailLine label="الدفع" value="عند الاستلام" />
        </dl>
        <OrderSummary />
        <div className="mt-2.5">
          <ActionButton
            label="تأكيد الطلب — الدفع عند الاستلام"
            ariaLabel="تأكيد الطلب التجريبي بالدفع عند الاستلام"
            testId="showcase-action-confirm-cod"
            onClick={onAdvance}
          />
        </div>
      </BotBubble>
    );
  }

  return (
    <BotBubble>
      <p className="font-bold text-status-success">تم تسجيل الطلب</p>
      <p className="mt-1">
        مرجع الطلب:{' '}
        <span className="font-semibold" dir="ltr" data-testid="showcase-customer-order">
          {PRODUCT_SHOWCASE_ORDER_REFERENCE}
        </span>
      </p>
      <OrderSummary />
      <p className="mt-2 text-xs font-semibold text-text-primary">
        الدفع عند الاستلام — بانتظار التحصيل
      </p>
      <div className="mt-2.5">
        {canAdvance ? (
          <ActionButton
            label="فتح إدارة الطلبات"
            ariaLabel={`فتح إدارة الطلبات لمتابعة الطلب التجريبي ${PRODUCT_SHOWCASE_ORDER_REFERENCE}`}
            testId="showcase-action-open-merchant"
            onClick={onAdvance}
          />
        ) : (
          <p className="text-xs font-semibold text-text-secondary">
            الطلب ظاهر الآن في إدارة المتجر.
          </p>
        )}
      </div>
    </BotBubble>
  );
}

function MerchantOrders({
  state,
  onAdvance,
}: {
  state: ShowcaseScene['merchant'];
  onAdvance: () => void;
}) {
  if (state === 'waiting') {
    return (
      <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-subtle bg-page px-4 py-6 text-center">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-control border border-border-subtle bg-surface text-base font-bold text-text-secondary"
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
            {PRODUCT_SHOWCASE_ORDER_REFERENCE}
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
        <span
          className="text-xs font-semibold"
          dir="ltr"
          data-testid="showcase-merchant-total"
        >
          {formatShowcaseMoney(PRODUCT_SHOWCASE_PRICES.totalMinor)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-text-secondary">الدفع عند الاستلام</span>
        <span className="text-text-secondary">عميل تجريبي</span>
      </div>
      {state === 'new' ? (
        <div className="mt-2.5">
          <ActionButton
            label="قبول الطلب"
            ariaLabel={`قبول الطلب التجريبي ${PRODUCT_SHOWCASE_ORDER_REFERENCE}`}
            testId="showcase-action-accept-order"
            onClick={onAdvance}
          />
        </div>
      ) : (
        <div className="mt-2.5 rounded-control border border-border-subtle bg-surface p-2.5">
          <p className="text-[11px] font-semibold text-text-secondary">
            الإجراء التالي المتاح
          </p>
          <p
            className="mt-1 text-sm font-semibold text-text-primary"
            data-testid="showcase-next-action-prepare"
          >
            بدء التجهيز
          </p>
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        {state === 'new'
          ? 'نفس مرجع الطلب الظاهر في المحادثة.'
          : 'تم قبول الطلب التجريبي. لا توجد خطوة إضافية مطلوبة في هذا العرض.'}
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

  function advance() {
    goTo(index + 1);
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
  const activePhaseBody = steps[scene.phase]?.body;

  return (
    <Section id="product-showcase" tone="dark">
      <Container className="flex flex-col gap-5 sm:gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <span className="w-fit rounded-control border border-brand-highlight px-3 py-1 text-xs font-semibold text-brand-highlight">
            عرض تفاعلي موجّه ببيانات اصطناعية
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
          <div className="mb-2 flex items-center gap-1.5 px-1 lg:hidden" role="group" aria-label="اختيار واجهة العرض">
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
              <div className="flex min-h-[13rem] flex-col gap-2 px-3 py-2.5">
                <CustomerConversation
                  state={scene.customer}
                  onAdvance={advance}
                  canAdvance={index < lastIndex}
                />
              </div>
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
              <div className="min-h-[13rem] px-3 py-2.5">
                <MerchantOrders state={scene.merchant} onAdvance={advance} />
              </div>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="sr-only" data-testid="showcase-live">
          الخطوة {index + 1} من {PRODUCT_SHOWCASE_SCENES.length}: {scene.title}.{' '}
          {scene.detail}
        </p>

        <div className="rounded-card border border-border-subtle bg-brand-primary p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <p className="text-xs font-semibold text-text-secondary">
                الخطوة <span dir="ltr">{index + 1}</span> من{' '}
                <span dir="ltr">{PRODUCT_SHOWCASE_SCENES.length}</span>
              </p>
              <p className="font-bold text-text-primary" data-testid="showcase-step-title">
                {scene.title}
              </p>
              <p className="sr-only" data-testid="showcase-step-detail">
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

          <div className="mt-3 border-t border-border-subtle pt-3">
            <ol className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="مراحل العرض">
              {steps.map((step, stepIndex) => {
                const active = scene.phase === stepIndex;
                return (
                  <li
                    key={step.title}
                    aria-current={active ? 'step' : undefined}
                    className={`flex items-center gap-1.5 text-xs ${
                      active
                        ? 'font-semibold text-text-primary'
                        : 'text-text-secondary'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        active
                          ? 'bg-brand-highlight text-brand-primary'
                          : 'border border-border-input'
                      }`}
                    >
                      {stepIndex + 1}
                    </span>
                    {step.title}
                  </li>
                );
              })}
            </ol>
            <p
              className="mt-1.5 text-xs leading-5 text-text-secondary"
              data-testid="showcase-phase-body"
            >
              {activePhaseBody}
            </p>
          </div>

          {reducedMotion ? (
            <p className="mt-2 text-xs leading-5 text-brand-highlight" data-testid="showcase-reduced-note">
              التشغيل التلقائي معطّل احتراماً لتفضيل تقليل الحركة في جهازك.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-5 text-text-secondary" data-testid="showcase-disclosure">
            <span className="font-semibold text-brand-highlight">{caption}.</span>{' '}
            عرض توضيحي ببيانات اصطناعية؛ لا يُنشئ طلباً حقيقياً أو يرسل بيانات،
            ولا يمثل واجهة الإنتاج النهائية.
          </p>
          <Button href={cta.href} size="lg">
            {cta.label}
          </Button>
        </div>
      </Container>
    </Section>
  );
}
