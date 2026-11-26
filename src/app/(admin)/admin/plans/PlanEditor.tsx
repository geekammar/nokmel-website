'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { adminPlansUi } from '@/content/ar/admin-plans';
import {
  PLAN_LIMITS,
  SUPPORTED_CURRENCIES,
  emptyPlanFormValues,
  formatPriceMinor,
  planFormValuesFromOwnerPlan,
  planSlugSchema,
  validatePlanForm,
  type OwnerPlan,
  type PlanFormValues,
} from '@/lib/plans/model';
import {
  PROMOTION_TIMEZONE_LABEL,
  cairoDateTimeInputs,
  emptyPromotionFormValues,
  formatCairoDateTime,
  formatSavedPercent,
  resolveOffer,
  type OfferResolution,
  type PromotionConfig,
  type PromotionFormValues,
  type PromotionState,
} from '@/lib/plans/promotion';
import {
  createPlanAction,
  hidePlanAction,
  publishPlanAction,
  savePlanAction,
} from './actions';

type Banner = { kind: 'success' | 'error' | 'info' | 'conflict'; text: string } | null;

function emptyValues(): PlanFormValues {
  return emptyPlanFormValues();
}

function serialize(values: PlanFormValues): string {
  return JSON.stringify(values);
}

function formatTimestamp(value: string | null): string {
  if (!value) return '';
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

function planDraftDiffers(plan: OwnerPlan): boolean {
  if (!plan.published) return false;
  return JSON.stringify(plan.draft) !== JSON.stringify(plan.published);
}

const secondaryButton =
  'inline-flex min-h-control items-center justify-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-60';

export function PlanEditor({
  plan: initialPlan,
  justCreated = false,
  nowIso,
}: {
  plan?: OwnerPlan;
  justCreated?: boolean;
  nowIso: string;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<OwnerPlan | null>(initialPlan ?? null);
  const [slug, setSlug] = useState(initialPlan?.slug ?? '');
  const [values, setValues] = useState<PlanFormValues>(() =>
    initialPlan ? planFormValuesFromOwnerPlan(initialPlan) : emptyValues(),
  );
  const [baseline, setBaseline] = useState(() =>
    serialize(initialPlan ? planFormValuesFromOwnerPlan(initialPlan) : emptyValues()),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(() =>
    justCreated ? { kind: 'success', text: adminPlansUi.messages.created } : null,
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const previewAsOf = useMemo(() => new Date(nowIso), [nowIso]);

  const busy = saving || publishing || hiding;
  const dirty = serialize(values) !== baseline;
  const createMode = !plan;

  const publicPreviewHref = plan ? `/admin/plans/${plan.id}/preview` : null;
  const statusLabel = plan
    ? plan.status === 'published'
      ? adminPlansUi.status.published
      : plan.status === 'hidden'
        ? adminPlansUi.status.hidden
        : adminPlansUi.status.draft
    : adminPlansUi.status.draft;
  const hasUnpublishedChanges = plan ? planDraftDiffers(plan) : false;

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function confirmLeave(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    if (!window.confirm(adminPlansUi.actions.leavingConfirm)) event.preventDefault();
  }

  function applyPlan(next: OwnerPlan) {
    const nextValues = planFormValuesFromOwnerPlan(next);
    setPlan(next);
    setValues(nextValues);
    setBaseline(serialize(nextValues));
    setErrors({});
  }

  function updateValue<K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  const promotionErrors = useMemo(() => {
    const next: Record<string, string> = {};
    for (const [key, message] of Object.entries(errors)) {
      if (key.startsWith('promotion.')) next[key.slice('promotion.'.length)] = message;
    }
    return next;
  }, [errors]);

  const draftPreview = useMemo((): {
    offer: OfferResolution;
    promotion: PromotionConfig | null;
    currency: PlanFormValues['currency'] | null;
  } | null => {
    const parsed = validatePlanForm(values);
    if (!parsed.ok || !parsed.values.currency) return null;
    const offer = resolveOffer(
      {
        slug: slug || 'preview-plan',
        publishedRevision: plan?.revision ?? 1,
        currency: parsed.values.currency,
        monthlyPriceMinor: parsed.values.monthlyPriceMinor,
        yearlyPriceMinor: parsed.values.yearlyPriceMinor,
        promotion: parsed.values.promotion,
      },
      previewAsOf,
    );
    return {
      offer,
      promotion: parsed.values.promotion,
      currency: parsed.values.currency,
    };
  }, [values, slug, plan?.revision, previewAsOf]);

  const promotionMathPreview = useMemo((): {
    offer: OfferResolution;
    currency: PlanFormValues['currency'];
  } | null => {
    const parsed = validatePlanForm(values);
    if (!parsed.ok || !parsed.values.currency || !parsed.values.promotion) {
      return null;
    }
    const promotion = parsed.values.promotion;
    const start = Date.parse(promotion.startsAt);
    const end = Date.parse(promotion.endsAt);
    const inside =
      Number.isFinite(start) && Number.isFinite(end) && start < end
        ? Math.min(Math.max(previewAsOf.getTime(), start), end - 1)
        : previewAsOf.getTime();
    return {
      offer: resolveOffer(
        {
          slug: slug || 'preview-plan',
          publishedRevision: plan?.revision ?? 1,
          currency: parsed.values.currency,
          monthlyPriceMinor: parsed.values.monthlyPriceMinor,
          yearlyPriceMinor: parsed.values.yearlyPriceMinor,
          promotion: { ...promotion, enabled: true },
        },
        new Date(inside),
      ),
      currency: parsed.values.currency,
    };
  }, [values, slug, plan?.revision, previewAsOf]);

  const publishedOffer = useMemo((): OfferResolution | null => {
    if (!plan?.published) return null;
    return resolveOffer(
      {
        slug: plan.slug,
        publishedRevision: plan.publishedRevision ?? plan.revision,
        currency: plan.published.currency,
        monthlyPriceMinor: plan.published.monthlyPriceMinor,
        yearlyPriceMinor: plan.published.yearlyPriceMinor,
        promotion: plan.published.promotion,
      },
      previewAsOf,
    );
  }, [plan, previewAsOf]);

  function updatePromotion(patch: Partial<PromotionFormValues>) {
    setValues((current) =>
      current.promotion
        ? { ...current, promotion: { ...current.promotion, ...patch } }
        : current,
    );
    setErrors((current) => {
      const next: Record<string, string> = {};
      for (const [key, message] of Object.entries(current)) {
        if (!key.startsWith('promotion.')) next[key] = message;
      }
      return next;
    });
  }

  function addPromotion() {
    const start = cairoDateTimeInputs(previewAsOf.toISOString());
    const end = cairoDateTimeInputs(
      new Date(previewAsOf.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    updateValue('promotion', {
      ...emptyPromotionFormValues(),
      startsDate: start.date,
      startsTime: start.time,
      endsDate: end.date,
      endsTime: end.time,
    });
  }

  function removePromotion() {
    updateValue('promotion', null);
  }

  function setPromotionDiscountType(discountType: PromotionFormValues['discountType']) {
    updatePromotion(
      discountType === 'percentage'
        ? { discountType, fixedMonthly: '', fixedYearly: '' }
        : { discountType, percentage: '' },
    );
  }

  function setPromotionTarget(target: PromotionFormValues['target']) {
    updatePromotion({
      target,
      ...(target === 'monthly' ? { fixedYearly: '' } : {}),
      ...(target === 'yearly' ? { fixedMonthly: '' } : {}),
    });
  }

  function promotionStateLabel(state: PromotionState): string {
    return adminPlansUi.promotion.stateLabels[state];
  }

  function updateFeature(index: number, value: string) {
    setValues((current) => {
      const features = [...current.features];
      features[index] = value;
      return { ...current, features };
    });
    setErrors((current) => {
      const key = `features.${index}`;
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function addFeature() {
    if (values.features.length >= PLAN_LIMITS.features) return;
    setValues((current) => ({ ...current, features: [...current.features, ''] }));
  }

  function removeFeature(index: number) {
    setValues((current) => ({
      ...current,
      features: current.features.filter((_, itemIndex) => itemIndex !== index),
    }));
    setErrors({});
  }

  function moveFeature(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= values.features.length) return;
    setValues((current) => {
      const features = [...current.features];
      [features[index], features[target]] = [features[target], features[index]];
      return { ...current, features };
    });
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (createMode) {
      const parsedSlug = planSlugSchema.safeParse(slug);
      if (!parsedSlug.success) {
        nextErrors.slug = parsedSlug.error.issues[0]?.message ?? 'المعرّف غير صالح.';
      }
    }
    const parsed = validatePlanForm(values);
    if (!parsed.ok) {
      for (const [key, message] of Object.entries(parsed.errors)) {
        nextErrors[key] ??= message;
      }
    }
    setErrors(nextErrors);
    const firstKey = Object.keys(nextErrors)[0];
    if (firstKey) {
      const id =
        firstKey === 'slug'
          ? 'plan-field-slug'
          : `plan-field-${firstKey.replace(/\./g, '-')}`;
      document.getElementById(id)?.focus();
      setBanner({ kind: 'error', text: adminPlansUi.messages.fixFields });
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (busy) return;
    setBanner(null);
    if (!validate()) return;
    setSaving(true);
    try {
      if (createMode) {
        const result = await createPlanAction({ slug, values });
        if (!result.ok) {
          setBanner({
            kind: result.code === 'conflict' ? 'conflict' : 'error',
            text: result.message,
          });
          if (result.fieldErrors) setErrors(result.fieldErrors);
          return;
        }
        router.push(`/admin/plans/${result.data.id}?created=1`);
        return;
      }
      const result = await savePlanAction({
        id: plan.id,
        revision: plan.revision,
        values,
      });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      applyPlan(result.data);
      setBanner({ kind: 'success', text: adminPlansUi.messages.saved });
      window.requestAnimationFrame(() => saveButtonRef.current?.focus());
    } catch {
      setBanner({ kind: 'error', text: adminPlansUi.messages.unexpected });
    } finally {
      setSaving(false);
    }
  }

  function requestPublish() {
    if (busy) return;
    if (!plan) return;
    if (dirty) {
      setBanner({ kind: 'error', text: adminPlansUi.messages.saveFirst });
      return;
    }
    setConfirmHide(false);
    setConfirmPublish(true);
    setBanner(null);
  }

  async function handleConfirmPublish() {
    if (busy || !plan) return;
    setPublishing(true);
    setBanner(null);
    try {
      const result = await publishPlanAction({
        id: plan.id,
        revision: plan.revision,
      });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        if (result.code === 'conflict') setConfirmPublish(false);
        return;
      }
      applyPlan(result.data);
      setConfirmPublish(false);
      setBanner({ kind: 'success', text: adminPlansUi.messages.published });
    } catch {
      setBanner({ kind: 'error', text: adminPlansUi.messages.unexpected });
    } finally {
      setPublishing(false);
    }
  }

  function requestHide() {
    if (busy || !plan) return;
    if (dirty) {
      setBanner({ kind: 'error', text: adminPlansUi.messages.saveFirst });
      return;
    }
    setConfirmPublish(false);
    setConfirmHide(true);
    setBanner(null);
  }

  async function handleConfirmHide() {
    if (busy || !plan) return;
    setHiding(true);
    setBanner(null);
    try {
      const result = await hidePlanAction({
        id: plan.id,
        revision: plan.revision,
      });
      if (!result.ok) {
        setBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        if (result.code === 'conflict') setConfirmHide(false);
        return;
      }
      applyPlan(result.data);
      setConfirmHide(false);
      setBanner({ kind: 'success', text: adminPlansUi.messages.hidden });
    } catch {
      setBanner({ kind: 'error', text: adminPlansUi.messages.unexpected });
    } finally {
      setHiding(false);
    }
  }

  const publishLabel = useMemo(
    () =>
      plan?.status === 'published'
        ? adminPlansUi.actions.publishUpdates
        : adminPlansUi.actions.publish,
    [plan?.status],
  );

  return (
    <div className="mx-auto w-full max-w-4xl" data-testid="plan-editor">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/plans"
          onClick={confirmLeave}
          className="w-fit text-sm font-semibold text-action-secondary underline-offset-4 hover:underline"
        >
          {adminPlansUi.backToList}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          {createMode ? adminPlansUi.createTitle : values.name || adminPlansUi.previewPage.title}
        </h1>
        {createMode ? (
          <p className="text-sm leading-7 text-text-secondary">
            {adminPlansUi.createDescription}
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            {adminPlansUi.fields.slug}:{' '}
            <span dir="ltr" className="font-mono text-xs">
              {plan.slug}
            </span>
          </p>
        )}
      </div>

      {plan ? (
        <div className="mt-4 rounded-card border border-border-subtle bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary" data-testid="plan-status">
            {adminPlansUi.status.label}: {statusLabel}
          </p>
          <p className="mt-1 text-xs text-text-secondary" data-testid="plan-revision">
            {adminPlansUi.status.revision}: {plan.revision}
            {' · '}
            {adminPlansUi.status.publishedRevision}:{' '}
            {plan.publishedRevision === null
              ? adminPlansUi.status.notPublished
              : plan.publishedRevision}
            {plan.publishedAt ? (
              <>
                {' · '}
                {adminPlansUi.status.lastPublished}:{' '}
                <span dir="ltr">{formatTimestamp(plan.publishedAt)}</span>
              </>
            ) : null}
          </p>
          {plan.status === 'hidden' ? (
            <p className="mt-2 text-sm text-status-warning">{adminPlansUi.status.hiddenNote}</p>
          ) : null}
          {hasUnpublishedChanges ? (
            <p className="mt-2 text-sm text-status-warning" data-testid="plan-unpublished-changes">
              {adminPlansUi.status.unpublishedChanges}
            </p>
          ) : plan.status === 'published' ? (
            <p className="mt-2 text-sm text-text-secondary">
              {adminPlansUi.status.publishedCurrent}
            </p>
          ) : null}
          {publicPreviewHref ? (
            <Link
              href={publicPreviewHref}
              className="mt-3 inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
            >
              {adminPlansUi.preview}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-5 rounded-card border border-border-subtle bg-surface p-4 sm:p-6">
        {createMode ? (
          <Input
            id="plan-field-slug"
            label={adminPlansUi.fields.slug}
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setErrors((current) => {
                const next = { ...current };
                delete next.slug;
                return next;
              });
            }}
            placeholder={adminPlansUi.fields.slugPlaceholder}
            maxLength={PLAN_LIMITS.slug}
            autoComplete="off"
            dir="ltr"
            error={errors.slug}
            aria-describedby="plan-slug-help"
          />
        ) : null}
        {createMode ? (
          <p id="plan-slug-help" className="-mt-3 text-xs text-text-secondary">
            {adminPlansUi.fields.slugHelp}
          </p>
        ) : null}

        <Input
          id="plan-field-name"
          label={adminPlansUi.fields.name}
          value={values.name}
          onChange={(event) => updateValue('name', event.target.value)}
          maxLength={PLAN_LIMITS.name}
          required
          autoComplete="off"
          error={errors.name}
        />
        <Textarea
          id="plan-field-description"
          label={adminPlansUi.fields.description}
          value={values.description}
          onChange={(event) => updateValue('description', event.target.value)}
          maxLength={PLAN_LIMITS.description}
          rows={3}
          required
          error={errors.description}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="plan-field-monthlyPrice"
            label={adminPlansUi.fields.monthlyPrice}
            value={values.monthlyPrice}
            onChange={(event) => updateValue('monthlyPrice', event.target.value)}
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            error={errors.monthlyPrice}
          />
          <Input
            id="plan-field-yearlyPrice"
            label={adminPlansUi.fields.yearlyPrice}
            value={values.yearlyPrice}
            onChange={(event) => updateValue('yearlyPrice', event.target.value)}
            inputMode="decimal"
            dir="ltr"
            autoComplete="off"
            error={errors.yearlyPrice}
          />
        </div>
        <p className="-mt-2 text-xs leading-5 text-text-secondary">
          {adminPlansUi.fields.priceHelp}
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="plan-field-currency" className="text-sm font-semibold text-text-primary">
              {adminPlansUi.fields.currency}
            </label>
            <select
              id="plan-field-currency"
              value={values.currency}
              onChange={(event) => updateValue('currency', event.target.value as PlanFormValues['currency'])}
              className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary"
              aria-invalid={errors.currency ? true : undefined}
              aria-describedby={errors.currency ? 'plan-field-currency-error' : undefined}
            >
              <option value="">{adminPlansUi.fields.currencyPlaceholder}</option>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.label} ({currency.code})
                </option>
              ))}
            </select>
            {errors.currency ? (
              <p id="plan-field-currency-error" role="alert" className="text-sm text-status-error">
                {errors.currency}
              </p>
            ) : null}
          </div>

          <Input
            id="plan-field-displayOrder"
            label={adminPlansUi.fields.displayOrder}
            type="number"
            min={0}
            max={PLAN_LIMITS.displayOrder}
            value={String(values.displayOrder)}
            onChange={(event) =>
              updateValue(
                'displayOrder',
                Number.isFinite(Number.parseInt(event.target.value, 10))
                  ? Number.parseInt(event.target.value, 10)
                  : 0,
              )
            }
            dir="ltr"
            error={errors.displayOrder}
            aria-describedby="plan-order-help"
          />
        </div>
        <p id="plan-order-help" className="-mt-2 text-xs text-text-secondary">
          {adminPlansUi.fields.displayOrderHelp}
        </p>

        <Input
          id="plan-field-ctaLabel"
          label={adminPlansUi.fields.ctaLabel}
          value={values.ctaLabel}
          onChange={(event) => updateValue('ctaLabel', event.target.value)}
          maxLength={PLAN_LIMITS.ctaLabel}
          required
          autoComplete="off"
          error={errors.ctaLabel}
        />

        <label className="flex min-h-control cursor-pointer items-center gap-3 text-sm font-semibold text-text-primary">
          <input
            type="checkbox"
            checked={values.featured}
            onChange={(event) => updateValue('featured', event.target.checked)}
            className="h-5 w-5 rounded border-border-interactive"
          />
          {adminPlansUi.fields.featured}
        </label>

        <fieldset className="flex flex-col gap-3 rounded-card border border-border-subtle p-4">
          <legend className="px-1 text-sm font-semibold text-text-primary">
            {adminPlansUi.fields.features}
          </legend>
          {values.features.length === 0 ? (
            <p className="text-sm text-text-secondary">{adminPlansUi.fields.noFeatures}</p>
          ) : null}
          {values.features.map((feature, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                id={`plan-field-features-${index}`}
                label={`${adminPlansUi.fields.featureItem} ${index + 1}`}
                value={feature}
                onChange={(event) => updateFeature(index, event.target.value)}
                maxLength={PLAN_LIMITS.feature}
                autoComplete="off"
                error={errors[`features.${index}`]}
                className="flex-1"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveFeature(index, -1)}
                  disabled={index === 0}
                  className={`${secondaryButton} px-3`}
                  aria-label={`${adminPlansUi.fields.moveFeatureUp} ${index + 1}`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveFeature(index, 1)}
                  disabled={index === values.features.length - 1}
                  className={`${secondaryButton} px-3`}
                  aria-label={`${adminPlansUi.fields.moveFeatureDown} ${index + 1}`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className={`${secondaryButton} px-3`}
                  aria-label={`${adminPlansUi.fields.removeFeature} ${index + 1}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={addFeature}
              disabled={values.features.length >= PLAN_LIMITS.features}
              className={secondaryButton}
            >
              {adminPlansUi.fields.addFeature}
            </button>
          </div>
        </fieldset>

        <section
          data-testid="plan-promotion-section"
          aria-labelledby="plan-promotion-title"
          className="flex flex-col gap-4 rounded-card border border-border-subtle p-4"
        >
          <div>
            <h2 id="plan-promotion-title" className="text-base font-bold text-text-primary">
              {adminPlansUi.promotion.sectionTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {adminPlansUi.promotion.sectionDescription}
            </p>
          </div>

          {!values.promotion ? (
            <div>
              <button
                type="button"
                onClick={addPromotion}
                className={secondaryButton}
                data-testid="plan-promotion-add"
              >
                {adminPlansUi.promotion.add}
              </button>
            </div>
          ) : (
            <>
              <label className="flex min-h-control cursor-pointer items-center gap-3 text-sm font-semibold text-text-primary">
                <input
                  type="checkbox"
                  checked={values.promotion.enabled}
                  onChange={(event) =>
                    updatePromotion({ enabled: event.target.checked })
                  }
                  className="h-5 w-5 rounded border-border-interactive"
                  data-testid="plan-promotion-enabled"
                />
                {adminPlansUi.promotion.enabled}
              </label>
              {!values.promotion.enabled ? (
                <p className="text-sm leading-6 text-status-warning">
                  {adminPlansUi.promotion.disabledHint}
                </p>
              ) : null}

              <Input
                id="plan-field-promotion-label"
                label={adminPlansUi.promotion.label}
                value={values.promotion.label}
                onChange={(event) => updatePromotion({ label: event.target.value })}
                placeholder={adminPlansUi.promotion.labelPlaceholder}
                maxLength={80}
                autoComplete="off"
                error={promotionErrors.label}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="plan-field-promotion-discountType"
                    className="text-sm font-semibold text-text-primary"
                  >
                    {adminPlansUi.promotion.discountType}
                  </label>
                  <select
                    id="plan-field-promotion-discountType"
                    value={values.promotion.discountType}
                    onChange={(event) =>
                      setPromotionDiscountType(
                        event.target.value as PromotionFormValues['discountType'],
                      )
                    }
                    className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary"
                  >
                    <option value="percentage">
                      {adminPlansUi.promotion.discountTypePercentage}
                    </option>
                    <option value="fixed">
                      {adminPlansUi.promotion.discountTypeFixed}
                    </option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="plan-field-promotion-target"
                    className="text-sm font-semibold text-text-primary"
                  >
                    {adminPlansUi.promotion.target}
                  </label>
                  <select
                    id="plan-field-promotion-target"
                    value={values.promotion.target}
                    onChange={(event) =>
                      setPromotionTarget(
                        event.target.value as PromotionFormValues['target'],
                      )
                    }
                    className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary"
                    aria-invalid={promotionErrors.target ? true : undefined}
                  >
                    <option value="monthly">
                      {adminPlansUi.promotion.targetMonthly}
                    </option>
                    <option value="yearly">
                      {adminPlansUi.promotion.targetYearly}
                    </option>
                    <option value="both">{adminPlansUi.promotion.targetBoth}</option>
                  </select>
                  {promotionErrors.target ? (
                    <p role="alert" className="text-sm text-status-error">
                      {promotionErrors.target}
                    </p>
                  ) : null}
                </div>
              </div>

              {values.promotion.discountType === 'percentage' ? (
                <Input
                  id="plan-field-promotion-percentage"
                  label={adminPlansUi.promotion.percentage}
                  value={values.promotion.percentage}
                  onChange={(event) =>
                    updatePromotion({ percentage: event.target.value })
                  }
                  inputMode="decimal"
                  dir="ltr"
                  autoComplete="off"
                  error={promotionErrors.percentage}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {values.promotion.target === 'monthly' ||
                  values.promotion.target === 'both' ? (
                    <Input
                      id="plan-field-promotion-fixedMonthly"
                      label={adminPlansUi.promotion.fixedMonthly}
                      value={values.promotion.fixedMonthly}
                      onChange={(event) =>
                        updatePromotion({ fixedMonthly: event.target.value })
                      }
                      inputMode="decimal"
                      dir="ltr"
                      autoComplete="off"
                      error={promotionErrors.fixedMonthly}
                    />
                  ) : null}
                  {values.promotion.target === 'yearly' ||
                  values.promotion.target === 'both' ? (
                    <Input
                      id="plan-field-promotion-fixedYearly"
                      label={adminPlansUi.promotion.fixedYearly}
                      value={values.promotion.fixedYearly}
                      onChange={(event) =>
                        updatePromotion({ fixedYearly: event.target.value })
                      }
                      inputMode="decimal"
                      dir="ltr"
                      autoComplete="off"
                      error={promotionErrors.fixedYearly}
                    />
                  ) : null}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="plan-field-promotion-startsDate"
                  label={adminPlansUi.promotion.startsDate}
                  type="date"
                  value={values.promotion.startsDate}
                  onChange={(event) =>
                    updatePromotion({ startsDate: event.target.value })
                  }
                  dir="ltr"
                  error={promotionErrors.startsDate}
                />
                <Input
                  id="plan-field-promotion-startsTime"
                  label={adminPlansUi.promotion.startsTime}
                  type="time"
                  value={values.promotion.startsTime}
                  onChange={(event) =>
                    updatePromotion({ startsTime: event.target.value })
                  }
                  dir="ltr"
                  aria-describedby={
                    promotionErrors.startsDate
                      ? 'plan-field-promotion-startsDate-error'
                      : undefined
                  }
                />
                <Input
                  id="plan-field-promotion-endsDate"
                  label={adminPlansUi.promotion.endsDate}
                  type="date"
                  value={values.promotion.endsDate}
                  onChange={(event) =>
                    updatePromotion({ endsDate: event.target.value })
                  }
                  dir="ltr"
                  error={promotionErrors.endsDate}
                />
                <Input
                  id="plan-field-promotion-endsTime"
                  label={adminPlansUi.promotion.endsTime}
                  type="time"
                  value={values.promotion.endsTime}
                  onChange={(event) =>
                    updatePromotion({ endsTime: event.target.value })
                  }
                  dir="ltr"
                  aria-describedby={
                    promotionErrors.endsDate
                      ? 'plan-field-promotion-endsDate-error'
                      : undefined
                  }
                />
              </div>
              <p className="-mt-2 text-xs leading-5 text-text-secondary">
                {adminPlansUi.promotion.timezoneNote}
              </p>

              <div
                data-testid="plan-promotion-status"
                className="rounded-card bg-background p-3 text-sm"
              >
                <p className="font-semibold text-text-primary">
                  {adminPlansUi.promotion.draftStatus}:{' '}
                  {draftPreview
                    ? promotionStateLabel(draftPreview.offer.state)
                    : '—'}
                </p>
                <p className="mt-1 text-text-secondary">
                  {adminPlansUi.promotion.publishedStatus}:{' '}
                  {plan?.published?.promotion
                    ? publishedOffer
                      ? promotionStateLabel(publishedOffer.state)
                      : '—'
                    : adminPlansUi.promotion.publishedNone}
                </p>
                {draftPreview?.offer.startsAt && draftPreview.offer.endsAt ? (
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {adminPlansUi.promotion.startsAt}:{' '}
                    <span dir="ltr">
                      {formatCairoDateTime(draftPreview.offer.startsAt)}
                    </span>{' '}
                    · {adminPlansUi.promotion.endsAt}:{' '}
                    <span dir="ltr">
                      {formatCairoDateTime(draftPreview.offer.endsAt)}
                    </span>{' '}
                    {PROMOTION_TIMEZONE_LABEL}
                  </p>
                ) : null}
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  {adminPlansUi.promotion.currentTimeNote}
                </p>
              </div>

              {promotionMathPreview ? (
                <div
                  data-testid="plan-promotion-preview"
                  className="rounded-card border border-border-subtle p-3"
                >
                  <h3 className="text-sm font-bold text-text-primary">
                    {adminPlansUi.promotion.previewTitle}
                  </h3>
                  <dl className="mt-2 flex flex-col gap-2 text-sm">
                    {promotionMathPreview.offer.monthly.baseMinor !== null ? (
                      <PromotionPreviewRow
                        label={adminPlansUi.promotion.priceMonthly}
                        offer={promotionMathPreview.offer.monthly}
                        currency={promotionMathPreview.currency}
                      />
                    ) : null}
                    {promotionMathPreview.offer.yearly.baseMinor !== null ? (
                      <PromotionPreviewRow
                        label={adminPlansUi.promotion.priceYearly}
                        offer={promotionMathPreview.offer.yearly}
                        currency={promotionMathPreview.currency}
                      />
                    ) : null}
                  </dl>
                  <p className="mt-2 text-xs leading-5 text-text-secondary">
                    {adminPlansUi.promotion.previewValuesNote}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  {adminPlansUi.promotion.previewNeedsValid}
                </p>
              )}

              <div>
                <button
                  type="button"
                  onClick={removePromotion}
                  className={secondaryButton}
                  data-testid="plan-promotion-remove"
                >
                  {adminPlansUi.promotion.remove}
                </button>
                <p className="mt-2 text-xs leading-5 text-text-secondary">
                  {adminPlansUi.promotion.removeHint}
                </p>
              </div>
            </>
          )}
        </section>

        {banner ? (
          <p
            role={banner.kind === 'success' ? 'status' : 'alert'}
            data-testid="plan-banner"
            className={`rounded-card border-s-4 p-4 text-sm leading-6 ${
              banner.kind === 'error' || banner.kind === 'conflict'
                ? 'border-status-error bg-background text-text-primary'
                : 'border-status-info bg-background text-text-primary'
            }`}
          >
            {banner.text}
            {banner.kind === 'conflict' ? (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${secondaryButton} mt-3`}
              >
                {adminPlansUi.actions.reload}
              </button>
            ) : null}
          </p>
        ) : null}

        {confirmPublish ? (
          <div
            data-testid="plan-publish-confirm"
            className="rounded-card border border-border-input bg-background p-4"
          >
            <p className="font-semibold text-text-primary">
              {adminPlansUi.confirm.publishTitle}
            </p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {adminPlansUi.confirm.publishBody}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleConfirmPublish}
                disabled={publishing}
                data-testid="plan-confirm-publish"
              >
                {publishing ? adminPlansUi.actions.publishing : adminPlansUi.actions.confirmPublish}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmPublish(false)}
                disabled={publishing}
              >
                {adminPlansUi.actions.cancelPublish}
              </Button>
            </div>
          </div>
        ) : null}

        {confirmHide ? (
          <div
            data-testid="plan-hide-confirm"
            className="rounded-card border border-border-input bg-background p-4"
          >
            <p className="font-semibold text-text-primary">{adminPlansUi.confirm.hideTitle}</p>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {adminPlansUi.confirm.hideBody}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleConfirmHide}
                disabled={hiding}
                data-testid="plan-confirm-hide"
              >
                {hiding ? adminPlansUi.actions.hiding : adminPlansUi.actions.confirmHide}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmHide(false)}
                disabled={hiding}
              >
                {adminPlansUi.actions.cancelHide}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            ref={saveButtonRef}
            type="button"
            onClick={handleSave}
            disabled={busy}
            data-testid="plan-save"
          >
            {saving ? adminPlansUi.actions.saving : adminPlansUi.actions.save}
          </Button>
          {plan ? (
            <button
              type="button"
              onClick={requestPublish}
              disabled={busy}
              className={secondaryButton}
              data-testid="plan-publish"
            >
              {publishLabel}
            </button>
          ) : null}
          {plan && plan.status === 'published' ? (
            <button
              type="button"
              onClick={requestHide}
              disabled={busy}
              className={secondaryButton}
              data-testid="plan-hide"
            >
              {adminPlansUi.actions.hide}
            </button>
          ) : null}
        </div>
        {dirty ? (
          <p className="text-sm font-semibold text-status-warning" data-testid="plan-dirty">
            لديك تغييرات غير محفوظة
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PromotionPreviewRow({
  label,
  offer,
  currency,
}: {
  label: string;
  offer: OfferResolution['monthly'];
  currency: PlanFormValues['currency'] | null;
}) {
  if (!currency) return null;
  const base = formatPriceMinor(offer.baseMinor, currency);
  const effective = formatPriceMinor(offer.effectiveMinor, currency);
  const saved = formatPriceMinor(offer.savedMinor, currency);
  const savedPercent = formatSavedPercent(offer.savedPercentBps);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="text-text-primary">
        {offer.discounted ? (
          <>
            <s className="text-text-secondary line-through" dir="ltr">
              {base}
            </s>{' '}
            <span className="font-bold" dir="ltr">
              {effective}
            </span>
            {saved ? (
              <span className="text-xs text-text-secondary" dir="ltr">
                {' '}
                ({adminPlansUi.promotion.savings}: {saved}
                {savedPercent ? ` · ${savedPercent}` : ''})
              </span>
            ) : null}
          </>
        ) : (
          <span dir="ltr">{effective ?? base}</span>
        )}
      </dd>
    </div>
  );
}
