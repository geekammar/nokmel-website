import { resolveLoopbackOriginOverride } from '@/lib/test-only-overrides';

/**
 * Server-only Telegram notification configuration (W5).
 *
 * The bot token is a server environment secret. The authorized destination is
 * stored in private owner settings, never in a public field. The website bot is
 * separate from every merchant/store bot in the commerce platform; this module
 * never reads or drains another bot's updates.
 */

const TOKEN_PATTERN = /^[0-9]{5,20}:[A-Za-z0-9_-]{20,200}$/;

export const TELEGRAM_DEFAULT_API_BASE = 'https://api.telegram.org';

export type TelegramConfig =
  | { status: 'configured'; token: string; apiBase: string }
  | { status: 'not_configured' | 'invalid'; apiBase: string };

export function resolveTelegramConfig(
  env: NodeJS.ProcessEnv = process.env,
): TelegramConfig {
  const apiBase =
    resolveLoopbackOriginOverride(env.TELEGRAM_API_BASE_URL, env) ??
    TELEGRAM_DEFAULT_API_BASE;
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  if (!token) return { status: 'not_configured', apiBase };
  if (!TOKEN_PATTERN.test(token)) return { status: 'invalid', apiBase };
  return { status: 'configured', token, apiBase };
}

export function telegramConfigReady(
  config: TelegramConfig,
): config is { status: 'configured'; token: string; apiBase: string } {
  return config.status === 'configured';
}
