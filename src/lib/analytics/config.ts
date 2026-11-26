import { createPrivateKey } from 'node:crypto';
import { resolveLoopbackOriginOverride, resolveLoopbackUrlOverride } from '@/lib/test-only-overrides';

/**
 * Server-only GA4 configuration (W5).
 *
 * The measurement ID is a public identifier by design; credentials are not.
 * Credentials are read only from server environment variables, never from
 * `NEXT_PUBLIC_*`, never sent to the client and never included in settings
 * responses or logs. Reporting uses a read-only service account and the
 * minimum `analytics.readonly` scope.
 */

export const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
export const GA4_DEFAULT_API_BASE = 'https://analyticsdata.googleapis.com';
export const GA4_DEFAULT_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GA4_DEFAULT_TAG_BASE = 'https://www.googletagmanager.com';

const PROPERTY_ID_PATTERN = /^[0-9]{6,20}$/;
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;
const CLIENT_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type AnalyticsReportingConfig =
  | {
      status: 'ready';
      propertyId: string;
      clientEmail: string;
      privateKey: string;
      apiBase: string;
      tokenEndpoint: string;
    }
  | { status: 'not_configured' | 'invalid'; reason: string };

export type AnalyticsTrackingConfig =
  | { status: 'ready'; measurementId: string; tagBase: string }
  | { status: 'not_configured' | 'invalid'; reason: string };

function unescapePrivateKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

export function resolveAnalyticsReportingConfig(
  env: NodeJS.ProcessEnv = process.env,
): AnalyticsReportingConfig {
  const propertyId = env.GA4_PROPERTY_ID?.trim() ?? '';
  const clientEmail = env.GA4_CLIENT_EMAIL?.trim() ?? '';
  const privateKeyRaw = env.GA4_PRIVATE_KEY?.trim() ?? '';
  if (!propertyId && !clientEmail && !privateKeyRaw) {
    return { status: 'not_configured', reason: 'credentials' };
  }
  if (!PROPERTY_ID_PATTERN.test(propertyId)) {
    return { status: 'invalid', reason: 'property_id' };
  }
  if (!CLIENT_EMAIL_PATTERN.test(clientEmail)) {
    return { status: 'invalid', reason: 'client_email' };
  }
  if (!privateKeyRaw || privateKeyRaw.length < 100) {
    return { status: 'invalid', reason: 'private_key' };
  }
  const privateKey = unescapePrivateKey(privateKeyRaw);
  try {
    createPrivateKey(privateKey);
  } catch {
    return { status: 'invalid', reason: 'private_key' };
  }
  return {
    status: 'ready',
    propertyId,
    clientEmail,
    privateKey,
    apiBase:
      resolveLoopbackOriginOverride(env.GA4_API_BASE_URL, env) ??
      GA4_DEFAULT_API_BASE,
    tokenEndpoint:
      resolveLoopbackUrlOverride(env.GA4_TOKEN_ENDPOINT, env) ??
      GA4_DEFAULT_TOKEN_ENDPOINT,
  };
}

export function resolveAnalyticsTrackingConfig(
  env: NodeJS.ProcessEnv = process.env,
): AnalyticsTrackingConfig {
  const measurementId = env.GA4_MEASUREMENT_ID?.trim() ?? '';
  if (!measurementId) return { status: 'not_configured', reason: 'measurement_id' };
  if (!MEASUREMENT_ID_PATTERN.test(measurementId)) {
    return { status: 'invalid', reason: 'measurement_id' };
  }
  return {
    status: 'ready',
    measurementId,
    tagBase:
      resolveLoopbackOriginOverride(env.GA4_TAG_BASE_URL, env) ??
      GA4_DEFAULT_TAG_BASE,
  };
}

export function reportingConfigReady(
  config: AnalyticsReportingConfig,
): config is Extract<AnalyticsReportingConfig, { status: 'ready' }> {
  return config.status === 'ready';
}
