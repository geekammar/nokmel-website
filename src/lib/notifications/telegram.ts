/**
 * Minimal official Telegram Bot API adapter (W5).
 *
 * Only `getMe` and `sendMessage` are used. The token stays in the request URL
 * path and is never logged or returned. There is no parse_mode, so generated
 * plain text cannot inject Telegram markup. Delivery is best-effort: a timeout
 * or ambiguous provider response is reported as `uncertain`, not as success.
 */

export type TelegramSendResult =
  | { kind: 'sent'; messageId: number }
  | { kind: 'failed'; code: TelegramErrorCode }
  | { kind: 'uncertain'; code: TelegramErrorCode };

export type TelegramErrorCode =
  | 'timeout'
  | 'transport'
  | 'unauthorized'
  | 'rate_limited'
  | 'rejected'
  | 'http_error'
  | 'invalid_response';

export type TelegramBotIdentity = {
  id: string;
  username: string | null;
  name: string | null;
};

export type TelegramGetMeResult =
  | { kind: 'ok'; bot: TelegramBotIdentity }
  | { kind: 'error'; code: TelegramErrorCode };

type FetchLike = typeof fetch;

const DEFAULT_TIMEOUT_MS = 6000;

export type SendTelegramMessageArgs = {
  token: string;
  chatId: string;
  text: string;
  apiBase: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

function classifyHttpStatus(status: number): TelegramErrorCode {
  if (status === 401 || status === 403 || status === 404) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'http_error';
  return 'rejected';
}

function errorCodeForException(error: unknown): TelegramErrorCode {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'timeout';
  }
  return 'transport';
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendTelegramMessage(
  args: SendTelegramMessageArgs,
): Promise<TelegramSendResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let response: Response;
  try {
    response = await fetchImpl(
      `${args.apiBase}/bot${args.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: args.chatId,
          text: args.text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      },
    );
  } catch (error) {
    return { kind: 'uncertain', code: errorCodeForException(error) };
  }

  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch (error) {
    return { kind: 'uncertain', code: errorCodeForException(error) };
  }
  const body = parseJsonObject(bodyText);

  if (response.status === 200) {
    if (!body || body.ok !== true) {
      return { kind: 'uncertain', code: 'invalid_response' };
    }
    const result = body.result;
    if (
      typeof result === 'object' &&
      result !== null &&
      typeof (result as { message_id?: unknown }).message_id === 'number'
    ) {
      return { kind: 'sent', messageId: (result as { message_id: number }).message_id };
    }
    return { kind: 'uncertain', code: 'invalid_response' };
  }

  const code = classifyHttpStatus(response.status);
  if (response.status >= 500) return { kind: 'uncertain', code };
  return { kind: 'failed', code };
}

export async function getTelegramBotIdentity(args: {
  token: string;
  apiBase: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<TelegramGetMeResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${args.apiBase}/bot${args.token}/getMe`, {
      method: 'GET',
      signal: AbortSignal.timeout(args.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    return { kind: 'error', code: errorCodeForException(error) };
  }
  let bodyText: string;
  try {
    bodyText = await response.text();
  } catch (error) {
    return { kind: 'error', code: errorCodeForException(error) };
  }
  if (response.status !== 200) {
    return { kind: 'error', code: classifyHttpStatus(response.status) };
  }
  const body = parseJsonObject(bodyText);
  const result = body?.result;
  if (
    !body ||
    body.ok !== true ||
    typeof result !== 'object' ||
    result === null ||
    typeof (result as { id?: unknown }).id !== 'number'
  ) {
    return { kind: 'error', code: 'invalid_response' };
  }
  const raw = result as { id: number; username?: unknown; first_name?: unknown };
  return {
    kind: 'ok',
    bot: {
      id: String(raw.id),
      username: typeof raw.username === 'string' ? raw.username : null,
      name: typeof raw.first_name === 'string' ? raw.first_name : null,
    },
  };
}
