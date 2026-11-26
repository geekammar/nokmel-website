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
  planFormValuesFromOwnerPlan,
  planSlugSchema,
  validatePlanForm,
  type OwnerPlan,
  type PlanFormValues,
} from '@/lib/plans/model';
import {
  createPlanAction,
  hidePlanAction,
  publishPlanAction,
  savePlanAction,
} from './actions';

type Banner = { kind: 'success' | 'error' | 'info' | 'conflict'; text: string } | null;

function emptyValues(): PlanFormValues {
  return {
    name: '',
    description: '',
    features: [],
    monthlyPrice: '',
    yearlyPrice: '',
    currency: '',
    ctaLabel: 'اطلب الانضمام',
    featured: false,
    displayOrder: 0,
  };
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
}: {
  plan?: OwnerPlan;
  justCreated?: boolean;
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
