import { NextResponse } from 'next/server';
import { ConfigError } from '@/lib/config-error';
import { getAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Better Auth route handler (documented mount: `/api/auth/[...all]`).
 * Lazy configuration access keeps the build/runtime safe when auth env is not
 * configured; admin access then fails closed.
 */

function failResponse(error: unknown): NextResponse {
  const message =
    error instanceof ConfigError
      ? 'خدمة المصادقة غير مهيأة. تواصل مع مشرف الموقع.'
      : 'خطأ غير متوقع. حاول مرة أخرى.';
  const status = error instanceof ConfigError ? 503 : 500;
  if (!(error instanceof ConfigError)) {
    console.error('Auth handler error:', error instanceof Error ? error.message : error);
  }
  return new NextResponse(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function dispatch(request: Request): Promise<NextResponse | Response> {
  try {
    return getAuth().handler(request);
  } catch (error) {
    return failResponse(error);
  }
}

export async function GET(request: Request): Promise<NextResponse | Response> {
  return dispatch(request);
}

export async function POST(request: Request): Promise<NextResponse | Response> {
  return dispatch(request);
}
