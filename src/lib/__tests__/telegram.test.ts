import { describe, expect, test } from 'vitest';
import {
  getTelegramBotIdentity,
  sendTelegramMessage,
} from '@/lib/notifications/telegram';
import { resolveTelegramConfig } from '@/lib/notifications/config';

const baseArgs = {
  token: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij',
  chatId: '9876543210123',
  text: 'رسالة تجريبية بلا بيانات عملاء',
  apiBase: 'https://api.telegram.org',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function neverFetch(): never {
  throw new Error('unexpected fetch');
}

describe('Telegram configuration', () => {
  test('validates the bot token and ignores loopback overrides on hosted runtimes', () => {
    const base = {
      TELEGRAM_BOT_TOKEN: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij',
      TELEGRAM_API_BASE_URL: 'http://127.0.0.1:3301',
    } as unknown as NodeJS.ProcessEnv;
    const hosted = resolveTelegramConfig({ ...base, VERCEL_ENV: 'preview' });
    expect(hosted.status).toBe('configured');
    if (hosted.status === 'configured') {
      expect(hosted.apiBase).toBe('https://api.telegram.org');
    }
    const disposable = resolveTelegramConfig({
      ...base,
      NOKMEL_DISPOSABLE_TEST_ENV: '1',
    });
    if (disposable.status === 'configured') {
      expect(disposable.apiBase).toBe('http://127.0.0.1:3301');
    }
    expect(resolveTelegramConfig({} as NodeJS.ProcessEnv).status).toBe('not_configured');
    expect(
      resolveTelegramConfig({
        TELEGRAM_BOT_TOKEN: 'not-a-token',
      } as unknown as NodeJS.ProcessEnv).status,
    ).toBe('invalid');
  });
});

describe('Telegram adapter classification', () => {
  test('sends plain text without parse_mode and returns the message id', async () => {
    let body: Record<string, unknown> | null = null;
    const result = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({ ok: true, result: { message_id: 77 } });
      }) as unknown as typeof fetch,
    });
    expect(result).toEqual({ kind: 'sent', messageId: 77 });
    expect(body).toMatchObject({
      chat_id: baseArgs.chatId,
      text: baseArgs.text,
      disable_web_page_preview: true,
    });
    expect(body).not.toHaveProperty('parse_mode');
  });

  test('maps provider rejections and rate limits to failed outcomes', async () => {
    const rejected = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: (async () =>
        jsonResponse({ ok: false, description: 'bad request' }, 400)) as unknown as typeof fetch,
    });
    expect(rejected).toEqual({ kind: 'failed', code: 'rejected' });

    const rateLimited = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: (async () =>
        jsonResponse({ ok: false, description: 'too many' }, 429)) as unknown as typeof fetch,
    });
    expect(rateLimited).toEqual({ kind: 'failed', code: 'rate_limited' });

    const unauthorized = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: (async () =>
        jsonResponse({ ok: false, description: 'unauthorized' }, 401)) as unknown as typeof fetch,
    });
    expect(unauthorized).toEqual({ kind: 'failed', code: 'unauthorized' });
  });

  test('server errors and malformed success bodies are uncertain, never sent', async () => {
    const serverError = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: (async () =>
        jsonResponse({ ok: false, description: 'unavailable' }, 502)) as unknown as typeof fetch,
    });
    expect(serverError).toEqual({ kind: 'uncertain', code: 'http_error' });

    const malformed = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: (async () => jsonResponse({ ok: true })) as unknown as typeof fetch,
    });
    expect(malformed).toEqual({ kind: 'uncertain', code: 'invalid_response' });
  });

  test('a timeout is uncertain because Telegram may have accepted the message', async () => {
    const timeout = async (): Promise<Response> => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    };
    const result = await sendTelegramMessage({
      ...baseArgs,
      fetchImpl: timeout as unknown as typeof fetch,
    });
    expect(result).toEqual({ kind: 'uncertain', code: 'timeout' });
  });

  test('getMe validates the bot identity and never logs the token', async () => {
    const ok = await getTelegramBotIdentity({
      token: baseArgs.token,
      apiBase: baseArgs.apiBase,
      fetchImpl: (async () =>
        jsonResponse({
          ok: true,
          result: { id: 42, is_bot: true, username: 'nokmel_bot', first_name: 'Nokmel' },
        })) as unknown as typeof fetch,
    });
    expect(ok).toEqual({
      kind: 'ok',
      bot: { id: '42', username: 'nokmel_bot', name: 'Nokmel' },
    });

    const invalid = await getTelegramBotIdentity({
      token: baseArgs.token,
      apiBase: baseArgs.apiBase,
      fetchImpl: (async () =>
        jsonResponse({ ok: true, result: { username: 'nokmel_bot' } })) as unknown as typeof fetch,
    });
    expect(invalid).toEqual({ kind: 'error', code: 'invalid_response' });

    const rejected = await getTelegramBotIdentity({
      token: baseArgs.token,
      apiBase: baseArgs.apiBase,
      fetchImpl: (async () =>
        jsonResponse({ ok: false, description: 'unauthorized' }, 401)) as unknown as typeof fetch,
    });
    expect(rejected).toEqual({ kind: 'error', code: 'unauthorized' });
  });

  test('a transport throw becomes an uncertain outcome instead of an exception', async () => {
    const result = await sendTelegramMessage({
      ...baseArgs,
      text: 'x',
      fetchImpl: neverFetch as unknown as typeof fetch,
    });
    expect(result).toEqual({ kind: 'uncertain', code: 'transport' });
  });
});
