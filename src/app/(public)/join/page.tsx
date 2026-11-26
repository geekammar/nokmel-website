import type { Metadata } from 'next';
import { JoinView, type JoinIntakeViewState } from '@/components/pages/JoinView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { isJoinIntakeEnabled } from '@/lib/join/intake-gate';
import {
  resolveJoinHmacSecret,
  resolveJoinOriginPolicy,
} from '@/lib/join/request-context';
import {
  sanitizeJoinSource,
  sanitizePlanQuery,
  sanitizeUtmValue,
} from '@/lib/join/validation';
import { getPublicPlans } from '@/lib/plans/service';
import { pageMetadataForSeo } from '@/lib/seo';

type JoinSearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('join');
  return pageMetadataForSeo('join', bundle.seo);
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<JoinSearchParams>;
}) {
  const [bundle, plansResult, params] = await Promise.all([
    getPublicPageBundle('join'),
    getPublicPlans(),
    searchParams,
  ]);
  const planSlug = sanitizePlanQuery(params.plan);
  const selectedPlan =
    planSlug === null
      ? null
      : plansResult.plans.find((plan) => plan.slug === planSlug) ?? null;
  const explicitSource = sanitizeJoinSource(params.source);
  const source =
    params.source === undefined && selectedPlan ? 'pricing' : explicitSource;
  const storageReady =
    plansResult.status === 'ok' || plansResult.status === 'invalid';
  const intakeSecurityConfigured =
    resolveJoinHmacSecret() !== null && resolveJoinOriginPolicy().configured;

  const intake: JoinIntakeViewState = {
    enabled: isJoinIntakeEnabled() && intakeSecurityConfigured,
    storageReady,
    plans: plansResult.plans,
    selectedPlan,
    source,
    utmSource: sanitizeUtmValue(params.utm_source),
    utmMedium: sanitizeUtmValue(params.utm_medium),
    utmCampaign: sanitizeUtmValue(params.utm_campaign),
  };

  return <JoinView content={bundle.content} intake={intake} />;
}
