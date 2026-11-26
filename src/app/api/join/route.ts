import { NextResponse } from 'next/server';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { isJoinIntakeEnabled } from '@/lib/join/intake-gate';
import { consumeJoinRateLimit } from '@/lib/join/rate-limit';
import {
  checkJoinRequestOrigin,
  deriveJoinBucketKey,
  resolveForwardedIdentity,
  resolveJoinHmacSecret,
  resolveJoinOriginPolicy,
} from '@/lib/join/request-context';
import { createJoinRequest } from '@/lib/join/service';
import {
  JoinPlanChangedError,
  JoinPlanUnavailableError,
  JoinStorageError,
} from '@/lib/join/errors';
import { parseJoinSubmission } from '@/lib/join/validation';

/**
 * Public join-intake endpoint (W4).
 *
 * POST-only. No GET/list/read capability exists. The server enforces the
 * fail-closed intake gate, exact origin policy, bounded body, durable rate
 * limit, strict validation and idempotency. Responses never expose stored
 * request rows, internal status/notes, sequential IDs or customer data.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): NextResponse {
  return jsonResponse(status, { ok: false, code, message, ...extra }, headers);
}

async function readLimitedBody(request: Request): Promise<
  { ok: true; text: string } | { ok: false; tooLarge: boolean }
> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (!Number.isFinite(declared) || declared < 0) {
      return { ok: false, tooLarge: false };
    }
    if (declared > MAX_BODY_BYTES) return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

export async function GET(): Promise<NextResponse> {
  return errorResponse(
    405,
    'method_not_allowed',
    'هذا المسار يقبل طلبات الإرسال فقط.',
    {},
    { allow: 'POST' },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isJoinIntakeEnabled()) {
    return errorResponse(
      403,
      'intake_disabled',
      'استلام طلبات الانضمام غير مفعّل حالياً، ولم يُرسل أي شيء.',
    );
  }

  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return errorResponse(
      415,
      'unsupported_media_type',
      'نوع الطلب غير مدعوم. أعد المحاولة من نموذج الانضمام.',
    );
  }

  const originPolicy = resolveJoinOriginPolicy();
  const hmacSecret = resolveJoinHmacSecret();
  if (!originPolicy.configured || !hmacSecret) {
    console.error('[join-intake] security configuration invalid', {
      reason: !hmacSecret ? 'secret' : 'origins',
    });
    return errorResponse(
      503,
      'intake_misconfigured',
      'استلام الطلبات غير متاح الآن. لم يُستلم طلبك. حاول لاحقاً.',
    );
  }
  const originCheck = checkJoinRequestOrigin(request.headers, originPolicy);
  if (!originCheck.ok) {
    return errorResponse(403, 'forbidden_origin', originCheck.message);
  }

  const body = await readLimitedBody(request);
  if (!body.ok) {
    return body.tooLarge
      ? errorResponse(413, 'payload_too_large', 'حجم الطلب أكبر من الحد المسموح.')
      : errorResponse(400, 'invalid_request', 'تعذّرت قراءة الطلب. أعد المحاولة.');
  }

  let db: ReturnType<typeof getDb>['db'];
  try {
    db = getDb().db;
  } catch (error) {
    if (!(error instanceof ConfigError)) {
      console.error('[join-intake] storage failure', { reason: 'unconfigured' });
    }
    return errorResponse(
      503,
      'storage_unavailable',
      'تعذّر تجهيز استلام الطلبات الآن. لم يُستلم طلبك. حاول لاحقاً.',
    );
  }

  const identity = resolveForwardedIdentity(request.headers);
  try {
    const decision = await consumeJoinRateLimit({
      db,
      bucketKey: deriveJoinBucketKey(identity, hmacSecret),
    });
    if (!decision.allowed) {
      return errorResponse(
        429,
        'rate_limited',
        'محاولات كثيرة خلال وقت قصير. لم يُستلم طلبك. انتظر قليلاً ثم حاول مرة أخرى.',
        { retryAfterSeconds: decision.retryAfterSeconds },
        { 'retry-after': String(decision.retryAfterSeconds) },
      );
    }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    console.error('[join-intake] rate-limit failure', {
      reason: code === '42P01' ? 'not_migrated' : 'unavailable',
    });
    return errorResponse(
      503,
      'storage_unavailable',
      'تعذّر تجهيز استلام الطلبات الآن. لم يُستلم طلبك. حاول لاحقاً.',
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body.text);
  } catch {
    return errorResponse(400, 'invalid_request', 'تعذّرت قراءة بيانات الطلب.');
  }

  const validation = parseJoinSubmission(raw);
  if (!validation.ok) {
    return errorResponse(
      400,
      'invalid_request',
      'تحقق من الحقول المميزة ثم أعد المحاولة.',
      { fieldErrors: validation.errors },
    );
  }

  try {
    const created = await createJoinRequest(validation.submission, { db });
    if (created.created) {
      /**
       * Best-effort owner notification after the accepted request committed.
       * It cannot roll back or invalidate the request and its failure is never
       * exposed to the public response (which stays minimal and generic).
       */
      try {
        const { deliverNewJoinRequestNotification } = await import(
          '@/lib/notifications/service'
        );
        await deliverNewJoinRequestNotification(created.id, { db });
      } catch (notificationError) {
        console.error('[join-intake] notification failed', {
          reason: notificationError instanceof Error ? notificationError.name : 'unknown',
        });
      }
    }
    return jsonResponse(200, { ok: true, status: 'received' });
  } catch (error) {
    if (error instanceof JoinPlanUnavailableError) {
      return errorResponse(409, 'plan_unavailable', error.message);
    }
    if (error instanceof JoinPlanChangedError) {
      return errorResponse(
        409,
        'plan_changed',
        'تغيّر العرض المختار بعد فتح النموذج. راجع العرض الحالي أو تابع بدون خطة.',
        {
          currentPlan: {
            slug: error.currentPlan.slug,
            name: error.currentPlan.name,
            currency: error.currentPlan.currency,
            publishedRevision: error.currentPlan.publishedRevision,
            offer: error.currentPlan.offer,
          },
        },
      );
    }
    if (error instanceof JoinStorageError) {
      console.error('[join-intake] create failed', { reason: 'storage' });
      return errorResponse(
        503,
        'storage_unavailable',
        'تعذّر تسجيل طلبك الآن. لم يُستلم الطلب. حاول لاحقاً.',
      );
    }
    console.error('[join-intake] create failed', { reason: 'unexpected' });
    return errorResponse(500, 'unexpected', 'تعذّر إكمال الطلب. حاول لاحقاً.');
  }
}
