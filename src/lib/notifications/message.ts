import { resolveAuthOriginConfig } from '@/lib/auth-origins';
import type { OfferSnapshot } from '@/lib/join/snapshot';
import type { JoinSource } from '@/lib/join/validation';

/**
 * Concise Arabic owner-notification message (W5).
 *
 * Plain text only: no `parse_mode`, therefore owner-entered plan/promotion
 * labels cannot inject Telegram markup. Personal request data (name, phone,
 * email, business activity, notes) is deliberately excluded. The only request
 * reference is the protected owner detail link built from the validated
 * server-controlled application origin.
 */

export type NotificationRequestContext = {
  id: string;
  planName: string | null;
  source: JoinSource;
  offerSnapshot: OfferSnapshot | null;
  offerSnapshotInvalid: boolean;
  createdAt: string;
};

const SOURCE_LABELS: Record<JoinSource, string> = {
  direct: 'مباشر',
  pricing: 'صفحة الأسعار',
  join: 'صفحة الانضمام',
};

function sanitizeLine(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function buildAdminRequestUrl(
  requestId: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!/^[A-Za-z0-9-]{1,80}$/.test(requestId)) return null;
  try {
    const { baseURL } = resolveAuthOriginConfig(env);
    return `${baseURL}/admin/requests/${requestId}`;
  } catch {
    return null;
  }
}

function promotionContext(context: NotificationRequestContext): string {
  if (!context.planName) return 'لا ينطبق — لم تُختر باقة';
  if (context.offerSnapshotInvalid) return 'غير معروف — لقطة غير صالحة';
  if (!context.offerSnapshot) return 'غير معروف — سجل قديم';
  if (context.offerSnapshot.promotion && context.offerSnapshot.promotionState === 'active') {
    return `نعم — ${sanitizeLine(context.offerSnapshot.promotion.label, 80)}`;
  }
  return 'لا — لم يكن هناك عرض فعّال وقت الإرسال';
}

function formatCairoTimestamp(iso: string): string {
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return 'غير معروف';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(epoch));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {
    return 'غير معروف';
  }
}

export function buildJoinNotificationMessage(
  context: NotificationRequestContext,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const link = buildAdminRequestUrl(context.id, env);
  if (!link) return null;
  const plan = context.planName
    ? sanitizeLine(context.planName, 120)
    : 'بدون خطة محددة';
  return [
    'طلب انضمام جديد',
    'الحالة: طلب جديد',
    `الخطة المطلوبة: ${plan}`,
    `مصدر الوصول: ${SOURCE_LABELS[context.source]}`,
    `عرض فعّال وقت الإرسال: ${promotionContext(context)}`,
    `وقت الإرسال (بتوقيت القاهرة): ${formatCairoTimestamp(context.createdAt)}`,
    `رابط الطلب: ${link}`,
  ].join('\n');
}

export const TELEGRAM_TEST_MESSAGE =
  'رسالة تجريبية من إعدادات موقع نكمّل. لا تحتوي على بيانات عملاء.';
