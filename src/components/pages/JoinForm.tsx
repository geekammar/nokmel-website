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

type PlanSource = {
  slug: string;
  name: string;
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  currency: PublicPlan['currency'];
  publishedRevision: number;
};

type PlanChangedResponse = PlanSource;

type Banner = {
  kind: 'success' | 'error' | 'info';
  text: string;
} | null;

type JoinApiResponse =
  | { ok: true; status: 'received'; duplicate?: boolean }
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
  planRevision: 'join-plan',
};

function priceSummary(plan: PlanSource): string {
  const monthly = formatPriceMinor(plan.monthlyPriceMinor, plan.currency);
  const yearly = formatPriceMinor(plan.yearlyPriceMinor, plan.currency);
  if (monthly && yearly) {
    return `${monthly} / ${yearly}`;
  }
  return monthly ?? yearly ?? publicPlansUi.priceLater;
}

export function JoinForm({
  content,
  plans,
  initialSelectedPlan,
  source,
  utmSource,
  utmMedium,
  utmCampaign,
}: {
  content: JoinContent;
  plans: PublicPlan[];
  initialSelectedPlan: PublicPlan | null;
  source: JoinSource;
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
  const [planSource, setPlanSource] = useState<PlanSource | null>(
    initialSelectedPlan ? { ...initialSelectedPlan } : null,
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
    selectedSlug === planSource?.slug
      ? planSource
      : plans.find((plan) => plan.slug === selectedSlug) ?? null;
  const planOptions = pendingPlan && !plans.some((plan) => plan.slug === pendingPlan.slug)
    ? [...plans, pendingPlan]
    : plans;

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
    setPlanSource(plans.find((plan) => plan.slug === value) ?? null);
    setBanner(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.planSlug;
      delete next.planRevision;
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
      payload.planRevision = selection.plan?.publishedRevision;
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
        setSelectedSlug('');
        setPlanSource(null);
        setPendingPlan(null);
        setPlanUnavailable(true);
        setBanner({ kind: 'error', text: publicJoinUi.errors.planUnavailable });
        return;
      }
      if (code === 'plan_changed' && apiError?.currentPlan) {
        setPendingPlan(apiError.currentPlan);
        setSelectedSlug(apiError.currentPlan.slug);
        setPlanSource(apiError.currentPlan);
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
    setPlanSource(null);
    setPendingPlan(null);
    setPlanUnavailable(false);
    setBanner(null);
    void send({ slug: '', plan: null });
  }

  function handleConfirmCurrentPlan() {
    if (!pendingPlan) return;
    setSelectedSlug(pendingPlan.slug);
    setPlanSource(pendingPlan);
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
    setPlanSource(null);
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

      {selectedPlan ? (
        <div
          className="rounded-card border-s-4 border-action-secondary bg-background p-4 text-sm"
          data-testid="selected-plan-context"
        >
          <p className="font-semibold text-text-primary">{publicJoinUi.selectedPlanTitle}</p>
          <p className="mt-1 text-text-primary">
            {selectedPlan.name}{' '}
            <span className="text-text-secondary" dir="ltr">
              ({priceSummary(selectedPlan)})
            </span>
          </p>
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
              aria-invalid={errors.planSlug || errors.planRevision ? true : undefined}
            >
              <option value="">{publicJoinUi.noPlan}</option>
              {planOptions.map((plan) => (
                <option key={plan.slug} value={plan.slug}>
                  {plan.name} — {priceSummary(plan)}
                </option>
              ))}
            </select>
            {errors.planSlug || errors.planRevision ? (
              <p role="alert" className="text-sm text-status-error">
                {errors.planSlug ?? errors.planRevision}
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
