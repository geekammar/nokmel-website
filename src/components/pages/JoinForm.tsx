'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { publicJoinUi } from '@/content/ar/join-request';
import { publicPlansUi } from '@/content/ar/plans';
import type { JoinContent } from '@/content/ar/join';
import {
  COUNTRY_CALLING_CODES,
  parseJoinSubmission,
  type JoinSource,
} from '@/lib/join/validation';
import { formatPriceMinor, type PublicPlan } from '@/lib/plans/model';
import {
  PROMOTION_TIMEZONE_LABEL,
  formatCairoDateTime,
  formatSavedPercent,
  type OfferResolution,
  type PeriodOffer,
} from '@/lib/plans/promotion';

type PlanSource = {
  slug: string;
  name: string;
  currency: PublicPlan['currency'];
  publishedRevision: number;
  offer: OfferResolution;
};

type PlanChangedResponse = PlanSource;

type Banner = {
  kind: 'success' | 'error' | 'info';
  text: string;
} | null;

type JoinApiResponse =
  | { ok: true; status: 'received' }
  | {
      ok: false;
      code: string;
      message?: string;
      fieldErrors?: Record<string, string>;
      retryAfterSeconds?: number;
      currentPlan?: PlanChangedResponse;
    };

const FIELD_IDS: Record<string, string> = {
  name: 'join-name',
  phone: 'join-phone',
  email: 'join-email',
  businessActivity: 'join-activity',
  planSlug: 'join-plan',
  offerVersion: 'join-plan',
};

function toPlanSource(plan: PublicPlan): PlanSource {
  return {
    slug: plan.slug,
    name: plan.name,
    currency: plan.currency,
    publishedRevision: plan.publishedRevision,
    offer: plan.offer,
  };
}

function priceSummary(plan: PlanSource): string {
  const monthly = formatPriceMinor(plan.offer.monthly.effectiveMinor, plan.currency);
  const yearly = formatPriceMinor(plan.offer.yearly.effectiveMinor, plan.currency);
  if (monthly && yearly) {
    return `${monthly} / ${yearly}`;
  }
  return monthly ?? yearly ?? publicPlansUi.priceLater;
}

function hasActivePromotion(plan: PlanSource): boolean {
  return plan.offer.monthly.discounted || plan.offer.yearly.discounted;
}

function planOptionText(plan: PlanSource): string {
  if (!hasActivePromotion(plan)) return priceSummary(plan);
  const parts: string[] = [];
  const monthly = formatPriceMinor(plan.offer.monthly.effectiveMinor, plan.currency);
  const yearly = formatPriceMinor(plan.offer.yearly.effectiveMinor, plan.currency);
  if (plan.offer.monthly.discounted && monthly) {
    const original = formatPriceMinor(plan.offer.monthly.baseMinor, plan.currency);
    parts.push(
      original
        ? `${publicPlansUi.monthly}: ${monthly} بدلاً من ${original}`
        : `${publicPlansUi.monthly}: ${monthly}`,
    );
  }
  if (plan.offer.yearly.discounted && yearly) {
    const original = formatPriceMinor(plan.offer.yearly.baseMinor, plan.currency);
    parts.push(
      original
        ? `${publicPlansUi.yearly}: ${yearly} بدلاً من ${original}`
        : `${publicPlansUi.yearly}: ${yearly}`,
    );
  }
  return parts.join(' · ') || priceSummary(plan);
}

export function JoinForm({
  content,
  plans,
  initialSelectedPlan,
  source,
  utmSource,
  utmMedium,
  utmCampaign,
  requestedPlanUnavailable = false,
}: {
  content: JoinContent;
  plans: PublicPlan[];
  initialSelectedPlan: PublicPlan | null;
  source: JoinSource;
  requestedPlanUnavailable?: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}) {
  const fieldsByName = useMemo(
    () => new Map(content.fields.map((field) => [field.name, field])),
    [content.fields],
  );

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [email, setEmail] = useState('');
  const [businessActivity, setBusinessActivity] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(initialSelectedPlan?.slug ?? '');
  const [planOptions, setPlanOptions] = useState<PlanSource[]>(() =>
    plans.map(toPlanSource),
  );
  const [submissionToken, setSubmissionToken] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [pendingPlan, setPendingPlan] = useState<PlanSource | null>(null);
  const [planUnavailable, setPlanUnavailable] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [intakeClosed, setIntakeClosed] = useState(false);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timeout = window.setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [retryAfter]);

  const selectedPlan =
    planOptions.find((plan) => plan.slug === selectedSlug) ?? null;

  function focusFirstError(nextErrors: Record<string, string>) {
    const firstKey = Object.keys(nextErrors)[0];
    if (!firstKey) return;
    const id = FIELD_IDS[firstKey];
    if (id) document.getElementById(id)?.focus();
  }

  function updateField(key: string, value: string) {
    if (key === 'name') setName(value);
    else if (key === 'phone') setPhone(value);
    else if (key === 'email') setEmail(value);
    else if (key === 'businessActivity') setBusinessActivity(value);
    setErrors((current) => {
      if (!(key in current) && !(key === 'phone' && 'countryCode' in current)) return current;
      const next = { ...current };
      delete next[key];
      delete next.countryCode;
      return next;
    });
  }

  function handlePlanChange(value: string) {
    setSelectedSlug(value);
    setPendingPlan(null);
    setPlanUnavailable(false);
    setBanner(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.planSlug;
      delete next.offerVersion;
      return next;
    });
  }

  async function send(selection: { slug: string; plan: PlanSource | null }) {
    if (submitting) return;
    setBanner(null);
    setErrors({});

    const payload: Record<string, unknown> = {
      name,
      phone,
      countryCode: countryCode || undefined,
      email,
      businessActivity,
      source,
      utmSource,
      utmMedium,
      utmCampaign,
      submissionToken,
    };
    if (selection.slug) {
      payload.planSlug = selection.slug;
      payload.offerVersion = selection.plan?.offer.version;
    }

    const validation = parseJoinSubmission(payload);
    if (!validation.ok) {
      setErrors(validation.errors);
      setBanner({ kind: 'error', text: publicJoinUi.errors.validation });
      focusFirstError(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      let body: JoinApiResponse | null = null;
      try {
        body = (await response.json()) as JoinApiResponse;
      } catch {
        body = null;
      }

      if (response.ok && body?.ok) {
        setSuccess(true);
        setBanner(null);
        setErrors({});
        return;
      }

      const apiError = body && !body.ok ? body : null;
      const code = apiError?.code ?? 'unexpected';
      if (code === 'invalid_request' && apiError?.fieldErrors) {
        setErrors(apiError.fieldErrors);
        setBanner({ kind: 'error', text: publicJoinUi.errors.validation });
        focusFirstError(apiError.fieldErrors);
        return;
      }
      if (code === 'intake_disabled') {
        setIntakeClosed(true);
        setBanner({ kind: 'error', text: publicJoinUi.errors.intakeDisabled });
        return;
      }
      if (code === 'rate_limited') {
        const seconds =
          apiError?.retryAfterSeconds ??
          Number.parseInt(response.headers.get('retry-after') ?? '', 10) ??
          60;
        setRetryAfter(Math.max(1, Number.isFinite(seconds) ? seconds : 60));
        return;
      }
      if (code === 'plan_unavailable') {
        const unavailableSlug = selection.slug;
        setPlanOptions((current) =>
          current.filter((plan) => plan.slug !== unavailableSlug),
        );
        setSelectedSlug('');
        setPendingPlan(null);
        setPlanUnavailable(true);
        setBanner({ kind: 'error', text: publicJoinUi.errors.planUnavailable });
        return;
      }
      if (code === 'plan_changed' && apiError?.currentPlan) {
        const updatedPlan = apiError.currentPlan;
        setPlanOptions((current) => {
          const exists = current.some((plan) => plan.slug === updatedPlan.slug);
          if (!exists) return [...current, updatedPlan];
          return current.map((plan) =>
            plan.slug === updatedPlan.slug ? updatedPlan : plan,
          );
        });
        setPendingPlan(updatedPlan);
        setSelectedSlug(updatedPlan.slug);
        setPlanUnavailable(false);
        setBanner({ kind: 'info', text: publicJoinUi.errors.planChanged });
        return;
      }
      if (code === 'payload_too_large') {
        setBanner({ kind: 'error', text: publicJoinUi.errors.payloadTooLarge });
        return;
      }
      if (code === 'storage_unavailable' || response.status === 503) {
        setBanner({
          kind: 'error',
          text: apiError?.message ?? publicJoinUi.errors.generic,
        });
        return;
      }
      setBanner({ kind: 'error', text: apiError?.message ?? publicJoinUi.errors.generic });
    } catch {
      setBanner({ kind: 'error', text: publicJoinUi.errors.network });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({ slug: selectedSlug, plan: selectedPlan });
  }

  function handleContinueWithoutPlan() {
    setSelectedSlug('');
    setPendingPlan(null);
    setPlanUnavailable(false);
    setBanner(null);
    void send({ slug: '', plan: null });
  }

  function handleConfirmCurrentPlan() {
    if (!pendingPlan) return;
    setSelectedSlug(pendingPlan.slug);
    setPlanUnavailable(false);
    setBanner(null);
    void send({ slug: pendingPlan.slug, plan: pendingPlan });
  }

  function resetForAnotherRequest() {
    setSuccess(false);
    setSubmissionToken(crypto.randomUUID());
    setBanner(null);
    setErrors({});
    setSelectedSlug('');
    setPendingPlan(null);
    setPlanUnavailable(false);
    setName('');
    setPhone('');
    setCountryCode('');
    setEmail('');
    setBusinessActivity('');
  }

  const nameField = fieldsByName.get('name');
  const phoneField = fieldsByName.get('phone');
  const emailField = fieldsByName.get('email');
  const activityField = fieldsByName.get('businessActivity');
  const disabled = submitting || intakeClosed || retryAfter > 0;

  if (success) {
    return (
      <Card className="flex flex-col gap-4" data-testid="join-success">
        <h2 className="text-xl font-bold text-status-success sm:text-2xl">
          {publicJoinUi.successTitle}
        </h2>
        <p className="leading-relaxed text-text-primary">{publicJoinUi.successBody}</p>
        <div>
          <Button type="button" variant="secondary" onClick={resetForAnotherRequest}>
            {publicJoinUi.successReset}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5" data-testid="join-form">
      <h2 className="text-xl font-bold sm:text-2xl">{content.formTitle}</h2>

      {requestedPlanUnavailable ? (
        <p
          role="note"
          data-testid="requested-plan-unavailable"
          className="rounded-card border-s-4 border-status-warning bg-background p-4 text-sm leading-6 text-text-primary"
        >
          {publicJoinUi.requestedPlanUnavailable}
        </p>
      ) : null}

      {selectedPlan ? (
        <div
          className="rounded-card border-s-4 border-action-secondary bg-background p-4 text-sm"
          data-testid="selected-plan-context"
        >
          <p className="font-semibold text-text-primary">{publicJoinUi.selectedPlanTitle}</p>
          <p className="mt-1 text-text-primary">{selectedPlan.name}</p>
          {hasActivePromotion(selectedPlan) ? (
            <div className="mt-2 flex flex-col gap-1" data-testid="selected-plan-offer">
              {selectedPlan.offer.label ? (
                <p className="text-text-primary">
                  {publicPlansUi.promotionLabel} «{selectedPlan.offer.label}»
                  {selectedPlan.offer.endsAt ? (
                    <span className="text-text-secondary">
                      {' '}
                      · {publicPlansUi.promotionEnds}:{' '}
                      <time dateTime={selectedPlan.offer.endsAt} dir="ltr">
                        {formatCairoDateTime(selectedPlan.offer.endsAt)}
                      </time>{' '}
                      {PROMOTION_TIMEZONE_LABEL}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {selectedPlan.offer.monthly.baseMinor !== null ? (
                <PeriodPriceLine
                  label={publicPlansUi.monthly}
                  period={selectedPlan.offer.monthly}
                  currency={selectedPlan.currency}
                />
              ) : null}
              {selectedPlan.offer.yearly.baseMinor !== null ? (
                <PeriodPriceLine
                  label={publicPlansUi.yearly}
                  period={selectedPlan.offer.yearly}
                  currency={selectedPlan.currency}
                />
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-text-secondary" dir="ltr">
              {priceSummary(selectedPlan)}
            </p>
          )}
          <p className="mt-1 text-xs text-text-secondary">{publicJoinUi.selectedPlanChange}</p>
        </div>
      ) : null}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="join-name"
            name="name"
            label={nameField?.label ?? 'الاسم الكامل'}
            autoComplete={nameField?.autoComplete}
            placeholder={nameField?.placeholder}
            value={name}
            onChange={(event) => updateField('name', event.target.value)}
            maxLength={120}
            required
            error={errors.name}
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="join-country" className="text-sm font-semibold text-text-primary">
              {publicJoinUi.countryLabel}
            </label>
            <select
              id="join-country"
              name="countryCode"
              value={countryCode}
              onChange={(event) => {
                setCountryCode(event.target.value);
                setErrors((current) => {
                  const next = { ...current };
                  delete next.phone;
                  return next;
                });
              }}
              className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary"
            >
              <option value="">{publicJoinUi.countryPlaceholder}</option>
              {COUNTRY_CALLING_CODES.map((country) => (
                <option key={country.code} value={country.callingCode}>
                  {country.label} ({country.callingCode})
                </option>
              ))}
            </select>
            <Input
              id="join-phone"
              name="phone"
              label={phoneField?.label ?? 'رقم الهاتف'}
              type="tel"
              inputMode="tel"
              autoComplete={phoneField?.autoComplete}
              placeholder={phoneField?.placeholder}
              value={phone}
              onChange={(event) => updateField('phone', event.target.value)}
              maxLength={40}
              required
              dir="ltr"
              error={errors.phone}
              aria-describedby="join-phone-hint"
            />
            <p id="join-phone-hint" className="text-xs leading-5 text-text-secondary">
              {publicJoinUi.phoneHint}
            </p>
          </div>

          <Input
            id="join-email"
            name="email"
            label={emailField?.label ?? publicJoinUi.optionalEmail}
            type="email"
            autoComplete={emailField?.autoComplete}
            placeholder={emailField?.placeholder}
            value={email}
            onChange={(event) => updateField('email', event.target.value)}
            maxLength={254}
            error={errors.email}
          />

          <Textarea
            id="join-activity"
            name="businessActivity"
            label={activityField?.label ?? 'نشاط التجارة (اختياري)'}
            placeholder={activityField?.placeholder}
            value={businessActivity}
            onChange={(event) => updateField('businessActivity', event.target.value)}
            maxLength={1000}
            rows={3}
            error={errors.businessActivity}
          />
        </div>

        {planOptions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="join-plan" className="text-sm font-semibold text-text-primary">
              {publicJoinUi.optionalPlan}
            </label>
            <select
              id="join-plan"
              name="planSlug"
              value={selectedSlug}
              onChange={(event) => handlePlanChange(event.target.value)}
              className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-3 text-base text-text-primary"
              aria-invalid={errors.planSlug || errors.offerVersion ? true : undefined}
            >
              <option value="">{publicJoinUi.noPlan}</option>
              {planOptions.map((plan) => (
                <option key={plan.slug} value={plan.slug}>
                  {plan.name} — {planOptionText(plan)}
                </option>
              ))}
            </select>
            {errors.planSlug || errors.offerVersion ? (
              <p role="alert" className="text-sm text-status-error">
                {errors.planSlug ?? errors.offerVersion}
              </p>
            ) : null}
          </div>
        ) : null}

        {banner ? (
          <p
            role={banner.kind === 'success' ? 'status' : 'alert'}
            className={`rounded-card border-s-4 p-4 text-sm leading-6 ${
              banner.kind === 'error'
                ? 'border-status-error bg-surface text-text-primary'
                : 'border-status-info bg-surface text-text-primary'
            }`}
          >
            {banner.text}
          </p>
        ) : null}

        {pendingPlan ? (
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleConfirmCurrentPlan} disabled={submitting}>
              {publicJoinUi.errors.planConfirmCurrent}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleContinueWithoutPlan}
              disabled={submitting}
            >
              {publicJoinUi.errors.planContinueWithout}
            </Button>
          </div>
        ) : null}

        {planUnavailable ? (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleContinueWithoutPlan}
              disabled={submitting}
            >
              {publicJoinUi.errors.planContinueWithout}
            </Button>
          </div>
        ) : null}

        {retryAfter > 0 ? (
          <p role="alert" className="rounded-card border-s-4 border-status-warning bg-surface p-4 text-sm text-text-primary">
            {publicJoinUi.errors.rateLimited.replace('{seconds}', String(retryAfter))}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={disabled} data-testid="join-submit">
            {submitting ? publicJoinUi.submitting : content.submit.label}
          </Button>
          <p className="text-sm text-text-secondary">{publicJoinUi.submitHint}</p>
        </div>
      </form>
    </Card>
  );
}

function PeriodPriceLine({
  label,
  period,
  currency,
}: {
  label: string;
  period: PeriodOffer;
  currency: PublicPlan['currency'];
}) {
  const base = formatPriceMinor(period.baseMinor, currency);
  const effective = formatPriceMinor(period.effectiveMinor, currency);
  const saved = formatPriceMinor(period.savedMinor, currency);
  const savedPercent = formatSavedPercent(period.savedPercentBps);
  if (!period.discounted || !base || !effective) {
    return (
      <p className="text-text-secondary">
        {label}: <span dir="ltr">{effective ?? base}</span>
      </p>
    );
  }
  return (
    <p className="text-text-secondary">
      {label}:{' '}
      <s className="line-through" dir="ltr">
        {base}
      </s>{' '}
      <span className="font-semibold text-text-primary" dir="ltr">
        {effective}
      </span>
      {saved ? (
        <span dir="ltr">
          {' '}
          · {publicPlansUi.savingsLabel} {saved}
          {savedPercent ? ` (${savedPercent})` : ''}
        </span>
      ) : null}
    </p>
  );
}
