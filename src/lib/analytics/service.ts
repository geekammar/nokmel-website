import {
  loadIntegrationSettings,
  type IntegrationSettings,
} from '@/lib/settings/service';
import type { Db } from '@/lib/db/types';
import type { AnalyticsDateRange, AnalyticsProviderResult } from './ga4';
import { getAnalyticsReport } from './ga4';
import {
  reportingConfigReady,
  resolveAnalyticsReportingConfig,
  resolveAnalyticsTrackingConfig,
} from './config';

/**
 * Dashboard analytics orchestration (W5-B). Business request metrics never
 * depend on the external provider: a disabled, unconfigured or failing GA4
 * integration only changes the analytics section of the overview.
 */

export type DashboardAnalyticsState =
  | { status: 'ok'; report: Extract<AnalyticsProviderResult, { status: 'ok' }>['report'] }
  | { status: 'disabled' }
  | { status: 'not_configured'; reason: string }
  | {
      status: 'unavailable';
      reason: Extract<AnalyticsProviderResult, { status: 'unavailable' }>['reason'];
    };

type AnalyticsServiceOptions = {
  env?: NodeJS.ProcessEnv;
  db?: Db;
  fetchImpl?: typeof fetch;
  integration?: IntegrationSettings;
};

export async function loadDashboardAnalytics(
  range: AnalyticsDateRange,
  options: AnalyticsServiceOptions = {},
): Promise<DashboardAnalyticsState> {
  const env = options.env ?? process.env;
  const integration =
    options.integration ?? (await loadIntegrationSettings({ db: options.db }));
  if (!integration.analyticsEnabled) return { status: 'disabled' };

  const config = resolveAnalyticsReportingConfig(env);
  if (!reportingConfigReady(config)) {
    return { status: 'not_configured', reason: config.reason };
  }

  const result = await getAnalyticsReport(range, {
    env,
    fetchImpl: options.fetchImpl,
  });
  if (result.status === 'ok') return { status: 'ok', report: result.report };
  return { status: 'unavailable', reason: result.reason };
}

export type PublicTrackingGate = {
  enabled: boolean;
  measurementId: string | null;
  tagBase: string | null;
};

/** Server-only decision for loading the public analytics script. */
export async function loadPublicTrackingGate(
  options: { env?: NodeJS.ProcessEnv; db?: Db } = {},
): Promise<PublicTrackingGate> {
  const env = options.env ?? process.env;
  const integration = await loadIntegrationSettings({ db: options.db });
  if (!integration.analyticsEnabled) {
    return { enabled: false, measurementId: null, tagBase: null };
  }
  const tracking = resolveAnalyticsTrackingConfig(env);
  if (tracking.status !== 'ready') {
    return { enabled: false, measurementId: null, tagBase: null };
  }
  return {
    enabled: true,
    measurementId: tracking.measurementId,
    tagBase: tracking.tagBase,
  };
}

export type AnalyticsConfigurationSummary = {
  reporting: {
    status: 'ready' | 'not_configured' | 'invalid';
    reason: string | null;
  };
  tracking: {
    status: 'ready' | 'not_configured' | 'invalid';
    reason: string | null;
  };
};

/** Owner settings status. Never includes credentials or secret values. */
export function analyticsConfigurationSummary(
  env: NodeJS.ProcessEnv = process.env,
): AnalyticsConfigurationSummary {
  const reporting = resolveAnalyticsReportingConfig(env);
  const tracking = resolveAnalyticsTrackingConfig(env);
  return {
    reporting:
      reporting.status === 'ready'
        ? { status: 'ready', reason: null }
        : { status: reporting.status, reason: reporting.reason },
    tracking:
      tracking.status === 'ready'
        ? { status: 'ready', reason: null }
        : { status: tracking.status, reason: tracking.reason },
  };
}
